import type {
	SockaContract,
	SockaContractConfig,
	InferSockaSend,
	InferSockaPushHandlers,
	InferSockaPushPayload,
} from "../core/contract";
import {
	reportSockaError,
	type SockaReportError,
} from "../core/socka-report-error";
import { parseStandardSchema } from "../core/validate";
import { SockaError } from "../core/socka-error";
import type {
	SockaServerResponseFrame,
	SockaServerErrorFrame,
	SockaServerEventFrame,
} from "../core/envelope";
import {
	SockaWebSocketClient,
	type SockaConnectionStatus,
	type SockaWebSocketClientOptions,
} from "./SockaWebSocketClient";
import { RESERVED_SOCKA_PROCEDURE_NAMES } from "../core/reserved-procedure-names";

type PendingEntry = {
	rpc: string;
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
};

type PushListenerFn = (payload: unknown) => void | Promise<void>;

/** Same strings as `RESERVED_SOCKA_PROCEDURE_NAMES` (core) for O(1) lookup on `send`. */
const RESERVED_CALL_NAMES = new Set<string>(RESERVED_SOCKA_PROCEDURE_NAMES);

export type SockaSessionPushWaitOptions<
	TContract extends SockaContract<SockaContractConfig>,
	K extends keyof TContract["pushes"] & string,
> = {
	signal?: AbortSignal;
	timeoutMs?: number;
	predicate?: (payload: InferSockaPushPayload<TContract, K>) => boolean;
};

export type SockaSessionSubscribeApi<
	TContract extends SockaContract<SockaContractConfig>,
> = {
	on<K extends keyof TContract["pushes"] & string>(
		name: K,
		handler: (
			payload: InferSockaPushPayload<TContract, K>,
		) => void | Promise<void>,
	): void;
	off<K extends keyof TContract["pushes"] & string>(
		name: K,
		handler: (
			payload: InferSockaPushPayload<TContract, K>,
		) => void | Promise<void>,
	): void;
	once<K extends keyof TContract["pushes"] & string>(
		name: K,
		handler: (
			payload: InferSockaPushPayload<TContract, K>,
		) => void | Promise<void>,
	): void;
	waitForPush<K extends keyof TContract["pushes"] & string>(
		name: K,
		options?: SockaSessionPushWaitOptions<TContract, K>,
	): Promise<InferSockaPushPayload<TContract, K>>;
};

function waitForPushAbortError(): Error {
	if (typeof DOMException !== "undefined") {
		return new DOMException("waitForPush aborted", "AbortError");
	}
	return new Error("socka: waitForPush aborted");
}

export type SockaSessionOptions<
	TContract extends SockaContract<SockaContractConfig>,
> = Omit<
	SockaWebSocketClientOptions<TContract>,
	"onResponse" | "onServerError" | "onEvent"
> & {
	onOpen?: (event: Event) => void;
	onClose?: (event: CloseEvent) => void;
	onError?: (event: Event) => void;
	pushHandlers?: Partial<InferSockaPushHandlers<TContract>>;
	/**
	 * Optional sink for client-side push pipeline failures (listener throws,
	 * push payload validation). Defaults to `console.error`; see
	 * `SockaReportError` in `@firtoz/socka/core`.
	 */
	reportError?: (event: SockaReportError) => void;
};

/**
 * Browser WebSocket session: **`session.send`** for contract calls, **`session.subscribe`**
 * for server pushes, **`session.client`** for low-level wire access.
 */
class SockaSessionBase<TContract extends SockaContract<SockaContractConfig>> {
	readonly client: SockaWebSocketClient<TContract>;
	readonly send: InferSockaSend<TContract>;
	readonly subscribe: SockaSessionSubscribeApi<TContract>;

	private readonly pending = new Map<string, PendingEntry>();
	private idSeq = 0;
	private readonly pushListeners = new Map<string, Set<PushListenerFn>>();
	private readonly reportError?: (event: SockaReportError) => void;

	constructor(options: SockaSessionOptions<TContract>) {
		const { pushHandlers, reportError, ...clientOpts } = options;
		this.reportError = reportError;

		this.client = new SockaWebSocketClient({
			...clientOpts,
			onResponse: (frame) => this.handleResponse(frame),
			onServerError: (frame) => this.handleServerError(frame),
			onEvent: (frame) => this.handleEvent(frame),
		});

		this.subscribe = this.createSubscribeApi();

		const sendBag = this.buildSendMethods();
		for (const name of Object.keys(sendBag)) {
			if (RESERVED_CALL_NAMES.has(name)) {
				throw new Error(
					`socka: call name "${name}" is reserved on SockaSession.send; rename it in defineSocka`,
				);
			}
		}
		this.send = sendBag;

		if (pushHandlers) {
			for (const key of Object.keys(pushHandlers) as Array<
				keyof InferSockaPushHandlers<TContract> & string
			>) {
				const fn = pushHandlers[key];
				if (fn) {
					this.subscribe.on(key, fn);
				}
			}
		}
	}

	private createSubscribeApi(): SockaSessionSubscribeApi<TContract> {
		return {
			on: (name, handler) => {
				this.addPushListener(name, handler as PushListenerFn);
			},
			off: (name, handler) => {
				this.removePushListener(name, handler as PushListenerFn);
			},
			once: (name, handler) => {
				const wrapped: PushListenerFn = (payload: unknown) => {
					this.removePushListener(name, wrapped);
					try {
						const result = (handler as (p: unknown) => void | Promise<void>)(
							payload,
						);
						void Promise.resolve(result).catch((error: unknown) => {
							reportSockaError(this.reportError, {
								kind: "clientEventListener",
								eventName: String(name),
								error,
							});
						});
					} catch (error) {
						reportSockaError(this.reportError, {
							kind: "clientEventListener",
							eventName: String(name),
							error,
						});
					}
				};
				this.addPushListener(name, wrapped);
			},
			waitForPush: (name, options) => this.waitForPushImpl(name, options),
		};
	}

	private addPushListener(name: string, handler: PushListenerFn): void {
		let set = this.pushListeners.get(name);
		if (!set) {
			set = new Set();
			this.pushListeners.set(name, set);
		}
		set.add(handler);
	}

	private removePushListener(name: string, handler: PushListenerFn): void {
		this.pushListeners.get(name)?.delete(handler);
	}

	private waitForPushImpl<K extends keyof TContract["pushes"] & string>(
		name: K,
		options?: SockaSessionPushWaitOptions<TContract, K>,
	): Promise<InferSockaPushPayload<TContract, K>> {
		return new Promise((resolve, reject) => {
			const signal = options?.signal;
			if (signal?.aborted) {
				reject(waitForPushAbortError());
				return;
			}

			const onAbort = () => {
				cleanup();
				reject(waitForPushAbortError());
			};
			signal?.addEventListener("abort", onAbort);

			let timeoutId: ReturnType<typeof setTimeout> | undefined;
			if (options?.timeoutMs != null) {
				timeoutId = setTimeout(() => {
					cleanup();
					reject(new Error("socka: waitForPush timed out"));
				}, options.timeoutMs);
			}

			const listener: PushListenerFn = (payload: unknown) => {
				if (
					options?.predicate &&
					!options.predicate(payload as InferSockaPushPayload<TContract, K>)
				) {
					return;
				}
				cleanup();
				resolve(payload as InferSockaPushPayload<TContract, K>);
			};

			const cleanup = () => {
				if (timeoutId !== undefined) clearTimeout(timeoutId);
				signal?.removeEventListener("abort", onAbort);
				this.removePushListener(name, listener);
			};

			this.addPushListener(name, listener);
		});
	}

	private buildSendMethods(): InferSockaSend<TContract> {
		const methods: Record<string, (input?: unknown) => Promise<unknown>> = {};

		for (const name of Object.keys(this.client.contract.calls)) {
			const proc = this.client.contract.calls[name];
			if (proc.input) {
				methods[name] = (input: unknown) => this.call(name, input);
			} else {
				methods[name] = () => this.call(name, undefined);
			}
		}

		return methods as InferSockaSend<TContract>;
	}

	private call(callName: string, input: unknown): Promise<unknown> {
		return (async () => {
			await this.client.connect();
			if (this.client.readyState !== WebSocket.OPEN) {
				throw new Error("WebSocket not connected");
			}
			const id = this.nextId(callName);
			const body =
				input !== undefined && input !== null
					? (input as Record<string, unknown>)
					: {};
			const proc = this.client.contract.calls[callName];
			if (proc !== undefined && proc.output === undefined) {
				try {
					this.client.sendRequest(id, callName, body);
				} catch (err) {
					throw err instanceof Error ? err : new Error(String(err));
				}
				return;
			}
			return new Promise<unknown>((resolve, reject) => {
				this.pending.set(id, { rpc: callName, resolve, reject });
				try {
					this.client.sendRequest(id, callName, body);
				} catch (err) {
					this.pending.delete(id);
					reject(err instanceof Error ? err : new Error(String(err)));
				}
			});
		})();
	}

	private handleResponse(frame: SockaServerResponseFrame): void {
		const proc = this.client.contract.calls[frame.rpc];
		if (!proc) {
			const entry = this.pending.get(frame.id);
			if (entry) {
				this.pending.delete(frame.id);
				entry.reject(new SockaError(`Unknown call: ${frame.rpc}`));
			}
			return;
		}
		if (proc.output === undefined) {
			const entry = this.pending.get(frame.id);
			if (entry) {
				this.pending.delete(frame.id);
				reportSockaError(this.reportError, {
					kind: "clientUnexpectedServerResponse",
					rpc: frame.rpc,
					requestId: frame.id,
				});
				entry.reject(
					new SockaError(
						"socka: unexpected serverResponse for fire-and-forget call",
						{ requestId: frame.id, rpc: frame.rpc },
					),
				);
			} else {
				reportSockaError(this.reportError, {
					kind: "clientUnexpectedServerResponse",
					rpc: frame.rpc,
					requestId: frame.id,
				});
			}
			return;
		}

		const entry = this.pending.get(frame.id);
		if (!entry) return;
		this.pending.delete(frame.id);

		void parseStandardSchema(proc.output, frame.body).then(
			(validated) => entry.resolve(validated),
			(err) =>
				entry.reject(err instanceof Error ? err : new Error(String(err))),
		);
	}

	private handleServerError(frame: SockaServerErrorFrame): void {
		const entry = this.pending.get(frame.id);
		if (entry) {
			this.pending.delete(frame.id);
			entry.reject(SockaError.fromWire(frame));
			return;
		}

		const err = SockaError.fromWire(frame);
		const rpcName = frame.rpc;
		if (rpcName === undefined) {
			reportSockaError(this.reportError, {
				kind: "clientFireAndForgetRpcError",
				error: err,
			});
			return;
		}
		const proc = this.client.contract.calls[rpcName];
		if (proc !== undefined && proc.output === undefined) {
			reportSockaError(this.reportError, {
				kind: "clientFireAndForgetRpcError",
				error: err,
			});
			return;
		}
		reportSockaError(this.reportError, {
			kind: "clientOrphanServerError",
			error: err,
		});
	}

	private handleEvent(frame: SockaServerEventFrame): void {
		const schema = (
			this.client.contract.pushes as Record<
				string,
				Parameters<typeof parseStandardSchema>[0] | undefined
			>
		)[frame.event];
		if (schema) {
			void parseStandardSchema(schema, frame.body).then(
				(validated) => this.dispatchValidatedPush(frame.event, validated),
				(error: unknown) =>
					reportSockaError(this.reportError, {
						kind: "clientEventValidation",
						eventName: frame.event,
						error,
					}),
			);
		} else {
			this.dispatchValidatedPush(frame.event, frame.body);
		}
	}

	private dispatchValidatedPush(pushName: string, payload: unknown): void {
		const set = this.pushListeners.get(pushName);
		if (!set || set.size === 0) return;
		for (const fn of [...set]) {
			try {
				const result = fn(payload);
				void Promise.resolve(result).catch((error: unknown) => {
					reportSockaError(this.reportError, {
						kind: "clientEventListener",
						eventName: pushName,
						error,
					});
				});
			} catch (error) {
				reportSockaError(this.reportError, {
					kind: "clientEventListener",
					eventName: pushName,
					error,
				});
			}
		}
	}

	private nextId(prefix: string): string {
		return `${prefix}-${++this.idSeq}`;
	}

	rejectAllPending(reason: Error): void {
		for (const [, entry] of this.pending) {
			entry.reject(reason);
		}
		this.pending.clear();
	}

	close(code?: number, reason?: string): void {
		this.client.close(code, reason);
	}

	/** Opens the WebSocket when using {@link SockaWebSocketClientOptions.autoConnect} `false`. */
	connect(): Promise<void> {
		return this.client.connect();
	}

	/** Same as {@link SockaWebSocketClient.status}. */
	get status(): SockaConnectionStatus {
		return this.client.status;
	}

	/** Same as {@link SockaWebSocketClient.onStatusChange}. */
	onStatusChange(
		listener: (status: SockaConnectionStatus) => void,
	): () => void {
		return this.client.onStatusChange(listener);
	}
}

export type SockaSession<TContract extends SockaContract<SockaContractConfig>> =
	SockaSessionBase<TContract>;

export interface SockaSessionConstructor {
	new <TContract extends SockaContract<SockaContractConfig>>(
		options: SockaSessionOptions<TContract>,
	): SockaSession<TContract>;
}

/**
 * WebSocket session: **`session.send`** for contract calls, **`session.subscribe`** for server pushes.
 */
export const SockaSession: SockaSessionConstructor =
	SockaSessionBase as SockaSessionConstructor;
