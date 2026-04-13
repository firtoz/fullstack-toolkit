import type { Context } from "hono";
import { BaseSession } from "@firtoz/websocket-do";
import type {
	SockaContract,
	SockaContractConfig,
	InferSockaHandlers,
} from "../core/contract";
import {
	SockaWebSocketSession,
	type SockaWebSocketSessionConfig,
} from "../server/SockaWebSocketSession";
import type { SockaWireFormat } from "../core/wire-codec";

/** Session data with no fields — `createData` may be omitted (defaults to `{}`). */
type EmptySockaSessionData = Record<string, never>;

type SockaDoOuterSession<
	TContract extends SockaContract<SockaContractConfig>,
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
	TContract extends SockaContract<SockaContractConfig>,
	TData,
	TEnv extends object,
> = {
	contract: TContract;
	/** Default `"json"`. Use `"msgpack"` for binary frames (must match client). */
	wireFormat?: SockaWireFormat;
	handlers: InferSockaHandlers<TContract, SockaDoOuterSession<TContract, TData, TEnv>>;
	handleClose: () => Promise<void>;
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
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
} & SockaDoSessionCreateData<TData, TEnv>;

/** Inner wire engine (narrow surface) — avoids invariant contract clashes on private fields. */
type SockaInnerWireEngine = {
	handleRawMessage(rawMessage: string): Promise<void>;
	handleBinaryMessage(buffer: ArrayBuffer): Promise<void>;
	emitEvent(event: string, body: unknown): void;
};

function wrapHandlersForInnerSockaEngine<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
	TEnv extends object,
>(
	contract: TContract,
	userHandlers: InferSockaHandlers<TContract, SockaDoSession<TContract, TData, TEnv>>,
	outer: SockaDoSession<TContract, TData, TEnv>,
): InferSockaHandlers<TContract, SockaWebSocketSession<TContract, EmptySockaSessionData>> {
	const procedures = contract.procedures;
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

	for (const key of Object.keys(procedures) as Array<keyof typeof procedures & string>) {
		const proc = procedures[key];
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
			out[key] = (_inner: SockaWebSocketSession<TContract, EmptySockaSessionData>) =>
				(userFn as (s: SockaDoSession<TContract, TData, TEnv>) => unknown | Promise<unknown>)(
					outer,
				);
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
	TContract extends SockaContract<SockaContractConfig>,
	TData = EmptySockaSessionData,
	TEnv extends object = Cloudflare.Env,
> extends BaseSession<TData, unknown, unknown, TEnv> {
	private socka!: SockaInnerWireEngine;

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
				handleClose: async () => config.handleClose(),
			},
		);
		const sockaConfig: SockaWebSocketSessionConfig<TContract, EmptySockaSessionData> = {
			contract: config.contract,
			wireFormat,
			handlers: wrapHandlersForInnerSockaEngine(
				config.contract,
				config.handlers,
				this,
			),
			handleClose: async () => {
				// BaseSession invokes `handleClose` from DO; wire engine has its own no-op.
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
	}

	public async handleRawMessage(rawMessage: string): Promise<void> {
		return this.socka.handleRawMessage(rawMessage);
	}

	/** Send a server event (non-RPC push) to this session. */
	public emitEvent(event: string, body: unknown): void {
		this.socka.emitEvent(event, body);
	}

	/** Broadcast a server event to all sessions (each encodes with its own wire format). */
	public broadcastEvent(
		event: string,
		body: unknown,
		excludeSelf = false,
	): void {
		for (const session of this.sessions.values()) {
			if (excludeSelf && session === this) continue;
			(session as SockaDoSession<TContract, TData, TEnv>).emitEvent(
				event,
				body,
			);
		}
	}
}
