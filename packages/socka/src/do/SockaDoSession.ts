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
	handlers: InferSockaHandlers<TContract>;
	handleClose: () => Promise<void>;
	onHandlerError?: (error: unknown, rpcName: string, input: unknown) => void;
	onValidationError?: (
		error: unknown,
		originalMessage: unknown,
	) => Promise<void>;
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
} & SockaDoSessionCreateData<TData, TEnv>;

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
	private readonly socka: SockaWebSocketSession<
		TContract,
		EmptySockaSessionData
	>;

	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, SockaDoSession<TContract, TData, TEnv>>,
		config: SockaDoSessionConfig<TContract, TData, TEnv>,
	) {
		const wireFormat = config.wireFormat ?? "json";
		const sockaConfig: SockaWebSocketSessionConfig<
			TContract,
			EmptySockaSessionData
		> = {
			contract: config.contract,
			wireFormat,
			handlers: config.handlers,
			handleClose: async () => {
				// BaseSession invokes `handleClose` from DO; wire engine has its own no-op.
			},
			onHandlerError: config.onHandlerError,
			onValidationError: config.onValidationError,
			serializeJson: config.serializeJson,
			deserializeJson: config.deserializeJson,
		};
		const socka = new SockaWebSocketSession(
			websocket,
			sessions as unknown as Map<
				WebSocket,
				SockaWebSocketSession<TContract, EmptySockaSessionData>
			>,
			sockaConfig,
		);
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
					await socka.handleBinaryMessage(message);
				},
				handleClose: async () => config.handleClose(),
			},
		);
		this.socka = socka;
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
