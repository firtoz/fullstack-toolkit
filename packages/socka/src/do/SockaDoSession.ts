import type { Context } from "hono";
import { BaseSession } from "@firtoz/websocket-do";
import type {
	SockaContract,
	SockaContractConfig,
	InferSockaHandlers,
} from "../core/contract";
import {
	SockaWireError,
	decodeSockaWire,
	encodeServerResponse,
	encodeServerError,
	encodeServerEvent,
} from "../core/envelope";
import { parseStandardSchema } from "../core/validate";
import { SockaError } from "../core/socka-error";

export type SockaDoSessionConfig<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
	TEnv extends object,
> = {
	contract: TContract;
	createData: (ctx: Context<{ Bindings: TEnv }>) => TData;
	handlers: InferSockaHandlers<TContract>;
	handleClose: () => Promise<void>;
	onHandlerError?: (error: unknown, rpcName: string, input: unknown) => void;
	onValidationError?: (
		error: unknown,
		originalMessage: unknown,
	) => Promise<void>;
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
};

/**
 * Durable Object WebSocket session driven by a socka contract.
 * Dispatches client requests to typed handler functions, validates
 * input/output via Standard Schema, and auto-sends response/error frames.
 */
export class SockaDoSession<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
	TEnv extends object = Cloudflare.Env,
> extends BaseSession<TData, unknown, unknown, TEnv> {
	private readonly config: SockaDoSessionConfig<TContract, TData, TEnv>;

	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, SockaDoSession<TContract, TData, TEnv>>,
		config: SockaDoSessionConfig<TContract, TData, TEnv>,
	) {
		super(
			websocket,
			sessions as Map<WebSocket, BaseSession<TData, unknown, unknown, TEnv>>,
			{
				createData: config.createData,
				handleMessage: async () => {
					// Raw message handling goes through handleRawMessage
				},
				handleBufferMessage: async () => {},
				handleClose: async () => config.handleClose(),
			},
		);
		this.config = config;
	}

	public async handleRawMessage(rawMessage: string): Promise<void> {
		const deserialize = this.config.deserializeJson ?? JSON.parse;
		const serialize = this.config.serializeJson ?? JSON.stringify;

		let parsed: unknown;
		try {
			parsed = deserialize(rawMessage);
		} catch {
			await this.reportValidationError(
				new Error("socka: invalid JSON"),
				rawMessage,
			);
			return;
		}

		let decoded: ReturnType<typeof decodeSockaWire>;
		try {
			decoded = decodeSockaWire(parsed);
		} catch (err) {
			if (err instanceof SockaWireError) {
				await this.reportValidationError(err, rawMessage);
				return;
			}
			throw err;
		}

		switch (decoded.kind) {
			case "clientRequest":
				break;
			case "serverResponse":
			case "serverError":
			case "serverEvent":
				await this.reportValidationError(
					new Error("socka: unexpected server-originated frame from client"),
					parsed,
				);
				return;
			default: {
				const _exhaustive: never = decoded;
				throw new Error(
					`socka: unexpected wire decode branch ${JSON.stringify(_exhaustive)}`,
				);
			}
		}

		const { frame } = decoded;
		const rpcName = frame.rpc;
		const procedure = this.config.contract.procedures[rpcName];

		if (!procedure) {
			const errorFrame = encodeServerError(
				frame.id,
				`Unknown procedure: ${rpcName}`,
			);
			this.sendWire(serialize(errorFrame));
			return;
		}

		let validatedInput: unknown;
		if (procedure.input) {
			try {
				validatedInput = await parseStandardSchema(procedure.input, frame.body);
			} catch (err) {
				const msg =
					err instanceof Error ? err.message : "Input validation failed";
				const errorFrame = encodeServerError(frame.id, msg);
				this.sendWire(serialize(errorFrame));
				return;
			}
		}

		const handler = (
			this.config.handlers as Record<
				string,
				(input: unknown) => unknown | Promise<unknown>
			>
		)[rpcName];

		let result: unknown;
		try {
			result = await handler(validatedInput);
		} catch (err) {
			this.config.onHandlerError?.(err, rpcName, validatedInput);
			const sockaErr =
				err instanceof SockaError
					? err
					: new SockaError(
							err instanceof Error ? err.message : "Handler failed",
						);
			const errorFrame = encodeServerError(frame.id, sockaErr.message);
			this.sendWire(serialize(errorFrame));
			return;
		}

		let validatedOutput: unknown;
		try {
			validatedOutput = await parseStandardSchema(procedure.output, result);
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Output validation failed";
			const errorFrame = encodeServerError(frame.id, msg);
			this.sendWire(serialize(errorFrame));
			return;
		}

		const responseFrame = encodeServerResponse(
			frame.id,
			rpcName,
			validatedOutput,
		);
		this.sendWire(serialize(responseFrame));
	}

	/** Send a server event (non-RPC push) to this session. */
	public emitEvent(event: string, body: unknown): void {
		const serialize = this.config.serializeJson ?? JSON.stringify;
		const frame = encodeServerEvent(event, body);
		this.sendWire(serialize(frame));
	}

	/** Broadcast a server event to all sessions. */
	public broadcastEvent(
		event: string,
		body: unknown,
		excludeSelf = false,
	): void {
		const serialize = this.config.serializeJson ?? JSON.stringify;
		const frame = encodeServerEvent(event, body);
		const wire = serialize(frame);
		for (const session of this.sessions.values()) {
			if (excludeSelf && session === this) continue;
			if (session instanceof SockaDoSession) {
				session.sendWire(wire);
			}
		}
	}

	private sendWire(data: string): void {
		if (this.websocket.readyState === WebSocket.OPEN) {
			this.websocket.send(data);
		}
	}

	private async reportValidationError(
		error: unknown,
		originalMessage: unknown,
	): Promise<void> {
		if (this.config.onValidationError) {
			await this.config.onValidationError(error, originalMessage);
		} else {
			console.error("socka: validation error:", error, originalMessage);
		}
	}
}
