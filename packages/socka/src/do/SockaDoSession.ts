import type { Context } from "hono";
import { BaseSession } from "@firtoz/websocket-do";
import type {
	InferSockaPushPayload,
	SockaContractBound,
	InferSockaHandlers,
} from "../core/contract";
import {
	SockaWebSocketSession,
	type SockaPushSession,
	type SockaWebSocketSessionConfigLoose,
} from "../server/SockaWebSocketSession";
import { reportSockaError } from "../core/socka-report-error";
import type { SockaReportError } from "../core/socka-report-error";
import type { SockaWireFormat } from "../core/wire-codec";

/** Session data with no fields — `createData` may be omitted (defaults to `{}`). */
type EmptySockaSessionData = Record<string, never>;

type SockaDoOuterSession<
	TContract extends SockaContractBound,
	TData,
	TEnv extends object,
> = import("./SockaDoSession").SockaDoSession<TContract, TData, TEnv>;

type SockaDoSessionCreateData<TData, TEnv extends object> = [TData] extends [
	EmptySockaSessionData,
]
	? {
			createData?: (ctx: Context<{ Bindings: TEnv }>) => TData;
		}
	: {
			createData: (ctx: Context<{ Bindings: TEnv }>) => TData;
		};

export type SockaDoSessionConfig<
	TContract extends SockaContractBound,
	TData,
	TEnv extends object,
> = {
	contract: TContract;
	/** Default `"json"`. Use `"msgpack"` for binary frames (must match client). */
	wireFormat?: SockaWireFormat;
	handlers: InferSockaHandlers<
		TContract,
		SockaDoOuterSession<TContract, TData, TEnv>
	>;
	handleClose: (
		session: SockaDoOuterSession<TContract, TData, TEnv>,
	) => Promise<void>;
	onHandlerError?: (
		error: unknown,
		rpcName: string,
		input: unknown,
		session: SockaDoOuterSession<TContract, TData, TEnv>,
	) => void;
	onValidationError?: (
		error: unknown,
		originalMessage: unknown,
	) => Promise<void>;
	/**
	 * Optional sink for non-RPC failures (e.g. `onAttached`). Defaults to
	 * `console.error`; see `SockaReportError` in `@firtoz/socka/core`.
	 */
	reportError?: (event: SockaReportError) => void;
	/**
	 * Called after this session is registered in the DO `sessions` map (next
	 * microtask). Use for join broadcasts and other logic that must run only
	 * when peers can see this connection.
	 */
	onAttached?: (
		session: SockaDoOuterSession<TContract, TData, TEnv>,
	) => void | Promise<void>;
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
} & SockaDoSessionCreateData<TData, TEnv>;

function runSockaDoSessionOnAttached<
	TContract extends SockaContractBound,
	TData,
	TEnv extends object,
>(
	config: SockaDoSessionConfig<TContract, TData, TEnv>,
	session: SockaDoSession<TContract, TData, TEnv>,
): void {
	const cb = config.onAttached;
	if (!cb) return;
	try {
		const result = cb(session);
		void Promise.resolve(result).catch((error: unknown) => {
			reportSockaError(config.reportError, {
				kind: "serverOnAttached",
				error,
			});
		});
	} catch (error) {
		reportSockaError(config.reportError, { kind: "serverOnAttached", error });
	}
}

function wrapHandlersForInnerSockaEngine<
	TContract extends SockaContractBound,
	TData,
	TEnv extends object,
>(
	contract: TContract,
	userHandlers: InferSockaHandlers<
		TContract,
		SockaDoSession<TContract, TData, TEnv>
	>,
	outer: SockaDoSession<TContract, TData, TEnv>,
): InferSockaHandlers<
	TContract,
	SockaWebSocketSession<TContract, EmptySockaSessionData>
> {
	const calls = contract.calls;
	const out: Record<
		string,
		| ((
				input: unknown,
				inner: SockaWebSocketSession<TContract, EmptySockaSessionData>,
		  ) => unknown | Promise<unknown>)
		| ((
				inner: SockaWebSocketSession<TContract, EmptySockaSessionData>,
		  ) => unknown | Promise<unknown>)
	> = {};

	for (const key of Object.keys(calls) as Array<keyof typeof calls & string>) {
		const proc = calls[key];
		const userFn = userHandlers[key as keyof typeof userHandlers];
		if (proc.input) {
			out[key] = (
				input,
				_inner: SockaWebSocketSession<TContract, EmptySockaSessionData>,
			) =>
				(
					userFn as (
						i: unknown,
						s: SockaDoSession<TContract, TData, TEnv>,
					) => unknown | Promise<unknown>
				)(input, outer);
		} else {
			out[key] = (
				_inner: SockaWebSocketSession<TContract, EmptySockaSessionData>,
			) =>
				(
					userFn as (
						s: SockaDoSession<TContract, TData, TEnv>,
					) => unknown | Promise<unknown>
				)(outer);
		}
	}

	return out as InferSockaHandlers<
		TContract,
		SockaWebSocketSession<TContract, EmptySockaSessionData>
	>;
}

/**
 * Durable Object WebSocket session driven by a socka contract.
 * Dispatches client requests to typed handler functions, validates
 * input/output via Standard Schema, and auto-sends response/error frames.
 */
export class SockaDoSession<
		TContract extends SockaContractBound,
		TData = EmptySockaSessionData,
		TEnv extends object = Cloudflare.Env,
	>
	extends BaseSession<TData, unknown, unknown, TEnv>
	implements SockaPushSession<TContract>
{
	private socka!: SockaWebSocketSession<TContract, EmptySockaSessionData>;

	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, SockaDoSession<TContract, TData, TEnv>>,
		config: SockaDoSessionConfig<TContract, TData, TEnv>,
	) {
		const wireFormat = config.wireFormat ?? "json";
		super(
			websocket,
			sessions as Map<WebSocket, BaseSession<TData, unknown, unknown, TEnv>>,
			{
				createData:
					config.createData ??
					((_ctx: Context<{ Bindings: TEnv }>) => ({}) as TData),
				handleMessage: async () => {
					// Raw message handling goes through handleRawMessage / handleBufferMessage
				},
				handleBufferMessage: async (message) => {
					await this.socka.handleBinaryMessage(message);
				},
				handleClose: async (baseSession) => {
					await config.handleClose(
						baseSession as SockaDoSession<TContract, TData, TEnv>,
					);
				},
			},
		);
		const sockaConfig: SockaWebSocketSessionConfigLoose<
			TContract,
			EmptySockaSessionData
		> = {
			strictUpgradeRequest: false,
			contract: config.contract,
			wireFormat,
			handlers: wrapHandlersForInnerSockaEngine(
				config.contract,
				config.handlers,
				this,
			),
			handleClose: async () => {
				// Outer DO lifecycle uses SockaDoSessionConfig.handleClose; inner engine no-op.
			},
			onHandlerError: config.onHandlerError
				? (err, rpcName, input, _inner) => {
						config.onHandlerError?.(err, rpcName, input, this);
					}
				: undefined,
			onValidationError: config.onValidationError,
			serializeJson: config.serializeJson,
			deserializeJson: config.deserializeJson,
		};
		this.socka = new SockaWebSocketSession(
			websocket,
			sessions as unknown as Map<
				WebSocket,
				SockaWebSocketSession<TContract, EmptySockaSessionData>
			>,
			sockaConfig,
		);
		// Defer past the outer `await createSession()` continuation so
		// `BaseSession.startFresh` has run and `session.data` exists (single
		// `queueMicrotask` runs before that continuation).
		queueMicrotask(() => {
			queueMicrotask(() => {
				runSockaDoSessionOnAttached(config, this);
			});
		});
	}

	public async handleRawMessage(rawMessage: string): Promise<void> {
		return this.socka.handleRawMessage(rawMessage);
	}

	public emitWireEvent(event: string, body: unknown): void {
		this.socka.emitWireEvent(event, body);
	}

	public emitPush<K extends keyof TContract["pushes"] & string>(
		name: K,
		body: InferSockaPushPayload<TContract, K>,
	): Promise<void> {
		return this.socka.emitPush(name, body);
	}

	public broadcastPush<K extends keyof TContract["pushes"] & string>(
		name: K,
		body: InferSockaPushPayload<TContract, K>,
		excludeSelf = false,
	): Promise<void> {
		return this.socka.broadcastPush(name, body, excludeSelf);
	}

	/**
	 * {@link SockaWebSocketSession.listPeers} for this Durable Object room.
	 */
	public listPeers(options?: { excludeSelf?: boolean }): TData[] {
		const out: TData[] = [];
		for (const [ws, s] of this.sessions) {
			if (options?.excludeSelf && ws === this.websocket) continue;
			out.push(s.data);
		}
		return out;
	}

	/**
	 * Like {@link listPeers} but maps each peer {@link SockaDoSession}.
	 */
	public listPeersWith<R>(
		map: (session: SockaDoSession<TContract, TData, TEnv>) => R,
		options?: { excludeSelf?: boolean },
	): R[] {
		const out: R[] = [];
		for (const [ws, s] of this.sessions) {
			if (options?.excludeSelf && ws === this.websocket) continue;
			out.push(map(s as SockaDoSession<TContract, TData, TEnv>));
		}
		return out;
	}

	public peerCount(options?: { excludeSelf?: boolean }): number {
		let n = 0;
		for (const [ws] of this.sessions) {
			if (options?.excludeSelf && ws === this.websocket) continue;
			n += 1;
		}
		return n;
	}

	public hasPeers(options?: { excludeSelf?: boolean }): boolean {
		return this.peerCount(options) > 0;
	}
}
