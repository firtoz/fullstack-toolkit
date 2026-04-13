import type {
	SockaContract,
	SockaContractConfig,
	InferSockaRpc,
	InferSockaEventHandlers,
	InferSockaEventPayload,
} from "../core/contract";
import { parseStandardSchema } from "../core/validate";
import { SockaError } from "../core/socka-error";
import type {
	SockaServerResponseFrame,
	SockaServerErrorFrame,
	SockaServerEventFrame,
} from "../core/envelope";
import {
	SockaWebSocketClient,
	type SockaWebSocketClientOptions,
} from "./SockaWebSocketClient";

type PendingEntry = {
	rpc: string;
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
};

type EventListenerFn = (payload: unknown) => void | Promise<void>;

export type SockaRpcEventWaitOptions<
	TContract extends SockaContract<SockaContractConfig>,
	K extends keyof TContract["events"] & string,
> = {
	signal?: AbortSignal;
	timeoutMs?: number;
	predicate?: (payload: InferSockaEventPayload<TContract, K>) => boolean;
};

export type SockaRpcEventsApi<
	TContract extends SockaContract<SockaContractConfig>,
> = {
	on<K extends keyof TContract["events"] & string>(
		name: K,
		handler: (
			payload: InferSockaEventPayload<TContract, K>,
		) => void | Promise<void>,
	): void;
	off<K extends keyof TContract["events"] & string>(
		name: K,
		handler: (
			payload: InferSockaEventPayload<TContract, K>,
		) => void | Promise<void>,
	): void;
	once<K extends keyof TContract["events"] & string>(
		name: K,
		handler: (
			payload: InferSockaEventPayload<TContract, K>,
		) => void | Promise<void>,
	): void;
	waitForEvent<K extends keyof TContract["events"] & string>(
		name: K,
		options?: SockaRpcEventWaitOptions<TContract, K>,
	): Promise<InferSockaEventPayload<TContract, K>>;
};

function waitForEventAbortError(): Error {
	if (typeof DOMException !== "undefined") {
		return new DOMException("waitForEvent aborted", "AbortError");
	}
	return new Error("socka: waitForEvent aborted");
}

export type SockaRpcOptions<
	TContract extends SockaContract<SockaContractConfig>,
> = Omit<
	SockaWebSocketClientOptions<TContract>,
	"onResponse" | "onServerError" | "onEvent"
> & {
	onOpen?: (event: Event) => void;
	onClose?: (event: CloseEvent) => void;
	onError?: (event: Event) => void;
	eventHandlers?: Partial<InferSockaEventHandlers<TContract>>;
};

/**
 * Browser WebSocket RPC session driven by a socka contract.
 * Generates fully typed RPC methods and manages pending correlation.
 */
export class SockaRpc<TContract extends SockaContract<SockaContractConfig>> {
	readonly client: SockaWebSocketClient<TContract>;
	readonly rpc: InferSockaRpc<TContract>;
	readonly events: SockaRpcEventsApi<TContract>;

	private readonly pending = new Map<string, PendingEntry>();
	private idSeq = 0;
	private readonly eventListeners = new Map<string, Set<EventListenerFn>>();

	constructor(options: SockaRpcOptions<TContract>) {
		const { eventHandlers, ...clientOpts } = options;

		this.client = new SockaWebSocketClient({
			...clientOpts,
			onResponse: (frame) => this.handleResponse(frame),
			onServerError: (frame) => this.handleServerError(frame),
			onEvent: (frame) => this.handleEvent(frame),
		});

		this.rpc = this.buildRpcMethods();
		this.events = this.createEventsApi();

		if (eventHandlers) {
			for (const key of Object.keys(eventHandlers) as Array<
				keyof InferSockaEventHandlers<TContract> & string
			>) {
				const fn = eventHandlers[key];
				if (fn) {
					this.events.on(key, fn);
				}
			}
		}
	}

	private createEventsApi(): SockaRpcEventsApi<TContract> {
		return {
			on: (name, handler) => {
				this.addEventListener(name, handler as EventListenerFn);
			},
			off: (name, handler) => {
				this.removeEventListener(name, handler as EventListenerFn);
			},
			once: (name, handler) => {
				const wrapped: EventListenerFn = (payload: unknown) => {
					this.removeEventListener(name, wrapped);
					void Promise.resolve(
						(handler as (p: unknown) => void | Promise<void>)(payload),
					).catch((err: unknown) => {
						console.error("socka: event listener error", err);
					});
				};
				this.addEventListener(name, wrapped);
			},
			waitForEvent: (name, options) => this.waitForEventImpl(name, options),
		};
	}

	private addEventListener(name: string, handler: EventListenerFn): void {
		let set = this.eventListeners.get(name);
		if (!set) {
			set = new Set();
			this.eventListeners.set(name, set);
		}
		set.add(handler);
	}

	private removeEventListener(name: string, handler: EventListenerFn): void {
		this.eventListeners.get(name)?.delete(handler);
	}

	private waitForEventImpl<K extends keyof TContract["events"] & string>(
		name: K,
		options?: SockaRpcEventWaitOptions<TContract, K>,
	): Promise<InferSockaEventPayload<TContract, K>> {
		return new Promise((resolve, reject) => {
			const signal = options?.signal;
			if (signal?.aborted) {
				reject(waitForEventAbortError());
				return;
			}

			const onAbort = () => {
				cleanup();
				reject(waitForEventAbortError());
			};
			signal?.addEventListener("abort", onAbort);

			let timeoutId: ReturnType<typeof setTimeout> | undefined;
			if (options?.timeoutMs != null) {
				timeoutId = setTimeout(() => {
					cleanup();
					reject(new Error("socka: waitForEvent timed out"));
				}, options.timeoutMs);
			}

			const listener: EventListenerFn = (payload: unknown) => {
				if (
					options?.predicate &&
					!options.predicate(payload as InferSockaEventPayload<TContract, K>)
				) {
					return;
				}
				cleanup();
				resolve(payload as InferSockaEventPayload<TContract, K>);
			};

			const cleanup = () => {
				if (timeoutId !== undefined) clearTimeout(timeoutId);
				signal?.removeEventListener("abort", onAbort);
				this.removeEventListener(name, listener);
			};

			this.addEventListener(name, listener);
		});
	}

	private buildRpcMethods(): InferSockaRpc<TContract> {
		const methods: Record<string, (input?: unknown) => Promise<unknown>> = {};

		for (const name of Object.keys(this.client.contract.procedures)) {
			const proc = this.client.contract.procedures[name];
			if (proc.input) {
				methods[name] = (input: unknown) => this.call(name, input);
			} else {
				methods[name] = () => this.call(name, undefined);
			}
		}

		return methods as InferSockaRpc<TContract>;
	}

	private call(procedure: string, input: unknown): Promise<unknown> {
		return (async () => {
			await this.client.connect();
			if (this.client.readyState !== WebSocket.OPEN) {
				throw new Error("WebSocket not connected");
			}
			const id = this.nextId(procedure);
			const body =
				input !== undefined && input !== null
					? (input as Record<string, unknown>)
					: {};
			return new Promise<unknown>((resolve, reject) => {
				this.pending.set(id, { rpc: procedure, resolve, reject });
				try {
					this.client.sendRequest(id, procedure, body);
				} catch (err) {
					this.pending.delete(id);
					reject(err instanceof Error ? err : new Error(String(err)));
				}
			});
		})();
	}

	private handleResponse(frame: SockaServerResponseFrame): void {
		const entry = this.pending.get(frame.id);
		if (!entry) return;
		this.pending.delete(frame.id);

		const proc = this.client.contract.procedures[frame.rpc];
		if (!proc) {
			entry.reject(new SockaError(`Unknown procedure: ${frame.rpc}`));
			return;
		}

		void Promise.resolve()
			.then(() => parseStandardSchema(proc.output, frame.body))
			.then(
				(validated) => entry.resolve(validated),
				(err) =>
					entry.reject(err instanceof Error ? err : new Error(String(err))),
			);
	}

	private handleServerError(frame: SockaServerErrorFrame): void {
		const entry = this.pending.get(frame.id);
		if (!entry) return;
		this.pending.delete(frame.id);
		entry.reject(SockaError.fromWire(frame));
	}

	private handleEvent(frame: SockaServerEventFrame): void {
		const schema = (
			this.client.contract.events as Record<
				string,
				Parameters<typeof parseStandardSchema>[0] | undefined
			>
		)[frame.event];
		if (schema) {
			void Promise.resolve()
				.then(() => parseStandardSchema(schema, frame.body))
				.then(
					(validated) => this.dispatchValidatedEvent(frame.event, validated),
					(err) => console.error("socka: event validation error", err),
				);
		} else {
			this.dispatchValidatedEvent(frame.event, frame.body);
		}
	}

	private dispatchValidatedEvent(eventName: string, payload: unknown): void {
		const set = this.eventListeners.get(eventName);
		if (!set || set.size === 0) return;
		for (const fn of [...set]) {
			void Promise.resolve(fn(payload)).catch((err: unknown) => {
				console.error("socka: event listener error", err);
			});
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
}
