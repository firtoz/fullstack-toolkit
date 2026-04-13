import { exhaustiveGuard } from "@firtoz/maybe-error";
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
	type SockaClientRequestFrame,
	type SockaWireFrame,
} from "../core/envelope";
import {
	encodeSockaWire,
	parseWirePayload,
	type SockaWireFormat,
} from "../core/wire-codec";
import { parseStandardSchema } from "../core/validate";
import { SockaError } from "../core/socka-error";

/** Session data with no fields — `createData` may be omitted (defaults to `{}`). */
type EmptySockaSessionData = Record<string, never>;

/** Optional upgrade context for {@link SockaWebSocketSession}. */
export type SockaWebSocketInit = {
	/** Original HTTP request for the WebSocket upgrade, when available. */
	request?: Request;
};

export type SockaEmitCapable = {
	emitEvent(event: string, body: unknown): void;
};

/**
 * Broadcast a socka server event to every session in the map (optionally
 * excluding the caller).
 */
export function broadcastSockaEventToPeers(
	sessions: Map<WebSocket, SockaEmitCapable>,
	self: SockaEmitCapable,
	event: string,
	body: unknown,
	excludeSelf = false,
): void {
	for (const session of sessions.values()) {
		if (excludeSelf && session === self) continue;
		session.emitEvent(event, body);
	}
}

type SockaWebSocketCreateData<TData> = [TData] extends [EmptySockaSessionData]
	? {
			createData?: (init: SockaWebSocketInit) => TData;
		}
	: {
			createData: (init: SockaWebSocketInit) => TData;
		};

export type SockaWebSocketSessionConfig<
	TContract extends SockaContract<SockaContractConfig>,
	TData = EmptySockaSessionData,
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
} & SockaWebSocketCreateData<TData>;

/**
 * Runtime-agnostic socka server session: standard {@link WebSocket} wire
 * dispatch without Cloudflare Durable Object APIs.
 */
export class SockaWebSocketSession<
	TContract extends SockaContract<SockaContractConfig>,
	TData = EmptySockaSessionData,
> {
	private readonly config: SockaWebSocketSessionConfig<TContract, TData>;
	private readonly wireFormat: SockaWireFormat;
	private _data!: TData;

	public constructor(
		public readonly websocket: WebSocket,
		protected readonly sessions: Map<
			WebSocket,
			SockaWebSocketSession<TContract, TData>
		>,
		config: SockaWebSocketSessionConfig<TContract, TData>,
		init?: SockaWebSocketInit,
	) {
		this.config = config;
		this.wireFormat = config.wireFormat ?? "json";
		const create =
			config.createData ?? ((_i: SockaWebSocketInit) => ({}) as TData);
		this._data = create(init ?? {});
	}

	public get data(): TData {
		return this._data;
	}

	public async handleRawMessage(rawMessage: string): Promise<void> {
		if (this.wireFormat !== "json") {
			await this.reportValidationError(
				new Error("socka: unexpected JSON frame in msgpack mode"),
				rawMessage,
			);
			return;
		}
		const deserialize = this.config.deserializeJson ?? JSON.parse;
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
		await this.dispatchAfterParsed(parsed, rawMessage);
	}

	public async handleBinaryMessage(buffer: ArrayBuffer): Promise<void> {
		if (this.wireFormat !== "msgpack") {
			await this.reportValidationError(
				new Error("socka: unexpected binary frame in JSON mode"),
				buffer,
			);
			return;
		}
		let parsed: unknown;
		try {
			parsed = parseWirePayload(buffer, "msgpack");
		} catch (err) {
			await this.reportValidationError(
				err instanceof Error ? err : new Error("socka: msgpack decode failed"),
				buffer,
			);
			return;
		}
		await this.dispatchAfterParsed(parsed, buffer);
	}

	private async dispatchAfterParsed(
		parsed: unknown,
		originalWire: unknown,
	): Promise<void> {
		let decoded: ReturnType<typeof decodeSockaWire>;
		try {
			decoded = decodeSockaWire(parsed);
		} catch (err) {
			if (err instanceof SockaWireError) {
				await this.reportValidationError(err, originalWire);
				return;
			}
			throw err;
		}

		switch (decoded.kind) {
			case "clientRequest":
				await this.dispatchClientRequest(decoded.frame, originalWire);
				return;
			case "serverResponse":
			case "serverError":
			case "serverEvent":
				await this.reportValidationError(
					new Error("socka: unexpected server-originated frame from client"),
					parsed,
				);
				return;
			default:
				exhaustiveGuard(decoded);
		}
	}

	private async dispatchClientRequest(
		frame: SockaClientRequestFrame,
		_originalWire: unknown,
	): Promise<void> {
		const rpcName = frame.rpc;
		const procedure = this.config.contract.procedures[rpcName];

		if (!procedure) {
			const errorFrame = encodeServerError(
				frame.id,
				`Unknown procedure: ${rpcName}`,
			);
			this.sendWireFrame(errorFrame);
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
				this.sendWireFrame(errorFrame);
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
			this.sendWireFrame(errorFrame);
			return;
		}

		let validatedOutput: unknown;
		try {
			validatedOutput = await parseStandardSchema(procedure.output, result);
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Output validation failed";
			const errorFrame = encodeServerError(frame.id, msg);
			this.sendWireFrame(errorFrame);
			return;
		}

		const responseFrame = encodeServerResponse(
			frame.id,
			rpcName,
			validatedOutput,
		);
		this.sendWireFrame(responseFrame);
	}

	private encodeOutgoing(frame: SockaWireFrame): string | Uint8Array {
		return encodeSockaWire(
			frame,
			this.wireFormat,
			this.config.serializeJson ?? JSON.stringify,
		);
	}

	private sendWireFrame(frame: SockaWireFrame): void {
		if (this.websocket.readyState !== WebSocket.OPEN) {
			return;
		}
		const encoded = this.encodeOutgoing(frame);
		if (typeof encoded === "string") {
			this.websocket.send(encoded);
			return;
		}
		const copy = new Uint8Array(encoded.byteLength);
		copy.set(encoded);
		this.websocket.send(copy.buffer);
	}

	/** Send a server event (non-RPC push) to this session. */
	public emitEvent(event: string, body: unknown): void {
		const frame = encodeServerEvent(event, body);
		this.sendWireFrame(frame);
	}

	/** Broadcast a server event to all sessions (each encodes with its own wire format). */
	public broadcastEvent(
		event: string,
		body: unknown,
		excludeSelf = false,
	): void {
		broadcastSockaEventToPeers(
			this.sessions as Map<WebSocket, SockaEmitCapable>,
			this,
			event,
			body,
			excludeSelf,
		);
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
