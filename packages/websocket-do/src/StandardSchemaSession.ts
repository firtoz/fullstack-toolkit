import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Context } from "hono";
import { BaseSession } from "./BaseSession";
import { parseStandardSchema } from "./parseStandardSchema";
import { standardSchemaMsgpack } from "./standardSchemaMsgpack";

export type StandardSchemaSessionOptions<TClientMessage, TServerMessage> = {
	clientSchema: StandardSchemaV1<unknown, TClientMessage>;
	serverSchema: StandardSchemaV1<unknown, TServerMessage>;
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
	enableBufferMessages?: boolean;
	sendProtocolError?: (
		websocket: WebSocket,
		errorMessage: string,
	) => Promise<void>;
};

export type StandardSchemaSessionHandlers<
	TData,
	TServerMessage,
	TClientMessage,
	TEnv extends object,
> = {
	createData: (ctx: Context<{ Bindings: TEnv }>) => TData;
	handleValidatedMessage: (message: TClientMessage) => Promise<void>;
	handleValidationError?: (
		error: unknown,
		originalMessage: unknown,
	) => Promise<void>;
	handleClose: (
		session: StandardSchemaSession<TData, TServerMessage, TClientMessage, TEnv>,
	) => Promise<void>;
};

export class StandardSchemaSession<
	TData,
	TServerMessage,
	TClientMessage,
	TEnv extends object = Cloudflare.Env,
> extends BaseSession<TData, TServerMessage, TClientMessage, TEnv> {
	private readonly clientCodec: ReturnType<
		typeof standardSchemaMsgpack<TClientMessage>
	>;
	private readonly serverCodec: ReturnType<
		typeof standardSchemaMsgpack<TServerMessage>
	>;
	protected readonly enableBufferMessages: boolean;

	constructor(
		websocket: WebSocket,
		sessions: Map<
			WebSocket,
			StandardSchemaSession<TData, TServerMessage, TClientMessage, TEnv>
		>,
		private readonly options: StandardSchemaSessionOptions<
			TClientMessage,
			TServerMessage
		>,
		private readonly schemaHandlers: StandardSchemaSessionHandlers<
			TData,
			TServerMessage,
			TClientMessage,
			TEnv
		>,
	) {
		super(websocket, sessions, {
			createData: schemaHandlers.createData,
			handleMessage: async (message) => {
				return this._internalHandleMessage(message);
			},
			handleBufferMessage: async (message) => {
				return this._internalHandleBufferMessage(message);
			},
			handleClose: async (
				session: BaseSession<TData, TServerMessage, TClientMessage, TEnv>,
			) => {
				return schemaHandlers.handleClose(
					session as StandardSchemaSession<
						TData,
						TServerMessage,
						TClientMessage,
						TEnv
					>,
				);
			},
		});

		this.clientCodec = standardSchemaMsgpack(options.clientSchema);
		this.serverCodec = standardSchemaMsgpack(options.serverSchema);
		this.enableBufferMessages = options.enableBufferMessages ?? false;
	}

	public async handleRawMessage(rawMessage: string): Promise<void> {
		if (this.enableBufferMessages) {
			console.error(
				"String messages not allowed when buffer messages are enabled",
			);
			await this.sendProtocolError(
				"String messages are not allowed. Please use buffer messages.",
			);
			return;
		}

		try {
			const parsed = this.deserializeJson(rawMessage);
			const validatedMessage = await parseStandardSchema(
				this.options.clientSchema,
				parsed,
			);
			await this.schemaHandlers.handleValidatedMessage(validatedMessage);
		} catch (error) {
			console.error("Invalid client message received:", error);
			await this._internalHandleValidationError(error, rawMessage);
		}
	}

	private async _internalHandleMessage(message: TClientMessage): Promise<void> {
		if (this.enableBufferMessages) {
			console.error(
				"String messages not allowed when buffer messages are enabled",
			);
			await this.sendProtocolError(
				"String messages are not allowed. Please use buffer messages.",
			);
			return;
		}

		try {
			const validatedMessage = await parseStandardSchema(
				this.options.clientSchema,
				message,
			);
			await this.schemaHandlers.handleValidatedMessage(validatedMessage);
		} catch (error) {
			console.error("Invalid client message received:", error);
			await this._internalHandleValidationError(error, message);
		}
	}

	private async _internalHandleBufferMessage(
		buffer: ArrayBuffer,
	): Promise<void> {
		if (!this.enableBufferMessages) {
			console.error(
				"Buffer messages not allowed when buffer messages are disabled",
			);
			return;
		}

		try {
			const bytes = new Uint8Array(buffer);
			const decodedMessage = await this.clientCodec.decode(bytes);
			await this.schemaHandlers.handleValidatedMessage(decodedMessage);
		} catch (error) {
			console.error("Failed to decode buffer message:", error);
			await this._internalHandleValidationError(error, buffer);
		}
	}

	private async _internalHandleValidationError(
		error: unknown,
		originalMessage: unknown,
	): Promise<void> {
		if (this.schemaHandlers.handleValidationError) {
			await this.schemaHandlers.handleValidationError(error, originalMessage);
		} else {
			console.error(
				"Validation error:",
				error,
				"Original message:",
				originalMessage,
			);
		}
	}

	public send(message: TServerMessage): void {
		if (this.enableBufferMessages) {
			void this.sendBufferAsync(message).catch((error: unknown) => {
				console.error("Failed to encode buffer message:", error);
			});
		} else {
			void this.sendJsonAsync(message).catch((error: unknown) => {
				console.error("Invalid server message to send:", error);
			});
		}
	}

	private async sendJsonAsync(message: TServerMessage): Promise<void> {
		const validatedMessage = await parseStandardSchema(
			this.options.serverSchema,
			message,
		);
		if (this.websocket.readyState !== WebSocket.OPEN) return;
		this.websocket.send(this.serializeJson(validatedMessage));
	}

	private async sendBufferAsync(message: TServerMessage): Promise<void> {
		const encodedMessage = await this.serverCodec.encode(message);
		if (this.websocket.readyState !== WebSocket.OPEN) return;
		this.websocket.send(encodedMessage);
	}

	private async sendProtocolError(errorMessage: string): Promise<void> {
		try {
			if (this.options.sendProtocolError) {
				await this.options.sendProtocolError(this.websocket, errorMessage);
			} else {
				if (this.websocket.readyState !== WebSocket.OPEN) return;
				this.websocket.send(this.serializeJson({ error: errorMessage }));
			}
		} catch (error) {
			console.error("Failed to send protocol error:", error);
		}
	}

	private serializeJson(value: unknown): string {
		return this.options.serializeJson
			? this.options.serializeJson(value)
			: JSON.stringify(value);
	}

	private deserializeJson(raw: string): unknown {
		return this.options.deserializeJson
			? this.options.deserializeJson(raw)
			: JSON.parse(raw);
	}

	public broadcast(message: TServerMessage, excludeSelf = false): void {
		for (const session of this.sessions.values()) {
			if (excludeSelf && session === this) continue;
			if (session instanceof StandardSchemaSession) {
				session.send(message);
			}
		}
	}
}
