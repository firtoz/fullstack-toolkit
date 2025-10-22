import type { Context } from "hono";
import type { ZodType } from "zod";
import { BaseSession } from "./BaseSession";
import { zodMsgpack } from "./zodMsgpack";

export type ZodSessionOptions<TClientMessage, TServerMessage> = {
	clientSchema: ZodType<TClientMessage>;
	serverSchema: ZodType<TServerMessage>;
	enableBufferMessages?: boolean;
	sendProtocolError?: (
		websocket: WebSocket,
		errorMessage: string,
	) => Promise<void>;
};

export type ZodSessionHandlers<
	TData,
	_TServerMessage,
	TClientMessage,
	TEnv extends object,
> = {
	createData: (ctx: Context<{ Bindings: TEnv }>) => TData;
	handleValidatedMessage: (message: TClientMessage) => Promise<void>;
	handleValidationError?: (
		error: unknown,
		originalMessage: unknown,
	) => Promise<void>;
	handleClose: () => Promise<void>;
};

export class ZodSession<
	TData,
	TServerMessage,
	TClientMessage,
	TEnv extends object = Cloudflare.Env,
> extends BaseSession<TData, TServerMessage, TClientMessage, TEnv> {
	private readonly clientCodec: ReturnType<typeof zodMsgpack<TClientMessage>>;
	private readonly serverCodec: ReturnType<typeof zodMsgpack<TServerMessage>>;
	protected readonly enableBufferMessages: boolean;

	constructor(
		websocket: WebSocket,
		sessions: Map<
			WebSocket,
			ZodSession<TData, TServerMessage, TClientMessage, TEnv>
		>,
		private readonly options: ZodSessionOptions<TClientMessage, TServerMessage>,
		private readonly zodHandlers: ZodSessionHandlers<
			TData,
			TServerMessage,
			TClientMessage,
			TEnv
		>,
	) {
		super(websocket, sessions, {
			createData: zodHandlers.createData,
			handleMessage: async (message) => {
				return this._internalHandleMessage(message);
			},
			handleBufferMessage: async (message) => {
				return this._internalHandleBufferMessage(message);
			},
			handleClose: async () => {
				return zodHandlers.handleClose();
			},
		});

		this.clientCodec = zodMsgpack(options.clientSchema);
		this.serverCodec = zodMsgpack(options.serverSchema);
		this.enableBufferMessages = options.enableBufferMessages ?? false;
	}

	// Internal method used by the base class handlers
	private async _internalHandleMessage(message: TClientMessage): Promise<void> {
		// If buffer messages are enabled, reject JSON messages
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
			// Validate the message using the client schema
			const validatedMessage = this.options.clientSchema.parse(message);
			await this.zodHandlers.handleValidatedMessage(validatedMessage);
		} catch (error) {
			console.error("Invalid client message received:", error);
			await this._internalHandleValidationError(error, message);
		}
	}

	// Internal method used by the base class handlers
	private async _internalHandleBufferMessage(
		buffer: ArrayBuffer,
	): Promise<void> {
		// If buffer messages are disabled, reject buffer messages
		if (!this.enableBufferMessages) {
			console.error(
				"Buffer messages not allowed when buffer messages are disabled",
			);
			// We can't use sendProtocolError here because it would send JSON
			// Just close the connection or ignore
			return;
		}

		try {
			const bytes = new Uint8Array(buffer);
			const decodedMessage = this.clientCodec.decode(bytes);
			await this.zodHandlers.handleValidatedMessage(decodedMessage);
		} catch (error) {
			console.error("Failed to decode buffer message:", error);
			await this._internalHandleValidationError(error, buffer);
		}
	}

	// Internal validation error handler
	private async _internalHandleValidationError(
		error: unknown,
		originalMessage: unknown,
	): Promise<void> {
		if (this.zodHandlers.handleValidationError) {
			await this.zodHandlers.handleValidationError(error, originalMessage);
		} else {
			// Default implementation logs and continues
			console.error(
				"Validation error:",
				error,
				"Original message:",
				originalMessage,
			);
		}
	}

	// Type-safe send method that automatically uses the correct format
	public send(message: TServerMessage): void {
		if (this.enableBufferMessages) {
			this.sendBuffer(message);
		} else {
			this.sendJson(message);
		}
	}

	// Explicitly send as JSON
	private sendJson(message: TServerMessage): void {
		try {
			// Validate the message using the server schema
			const validatedMessage = this.options.serverSchema.parse(message);

			if (this.websocket.readyState !== WebSocket.OPEN) return;

			this.websocket.send(JSON.stringify(validatedMessage));
		} catch (error) {
			console.error("Invalid server message to send:", error);
		}
	}

	// Explicitly send as buffer using msgpack
	private sendBuffer(message: TServerMessage): void {
		try {
			const encodedMessage = this.serverCodec.encode(message);

			if (this.websocket.readyState !== WebSocket.OPEN) return;

			this.websocket.send(encodedMessage);
		} catch (error) {
			console.error("Failed to encode buffer message:", error);
		}
	}

	// Send a protocol error message (always as JSON for compatibility by default)
	private async sendProtocolError(errorMessage: string): Promise<void> {
		try {
			// Use custom handler if provided, otherwise use default
			if (this.options.sendProtocolError) {
				await this.options.sendProtocolError(this.websocket, errorMessage);
			} else {
				// Default implementation: send a simple error object - no schema validation needed
				if (this.websocket.readyState !== WebSocket.OPEN) return;
				this.websocket.send(JSON.stringify({ error: errorMessage }));
			}
		} catch (error) {
			console.error("Failed to send protocol error:", error);
		}
	}

	// Type-safe broadcast that validates server messages
	// Automatically uses the correct format based on session configuration
	public broadcast(message: TServerMessage, excludeSelf = false): void {
		for (const session of this.sessions.values()) {
			if (excludeSelf && session === this) continue;
			if (session instanceof ZodSession) {
				session.send(message); // send() automatically uses correct format
			}
		}
	}
}
