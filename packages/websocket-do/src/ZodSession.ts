import type { ZodType } from "zod";
import { BaseSession } from "./BaseSession";
import { zodMsgpack } from "./zodMsgpack";

export interface ZodSessionOptions<TClientMessage, TServerMessage> {
	clientSchema: ZodType<TClientMessage>;
	serverSchema: ZodType<TServerMessage>;
	enableBufferMessages?: boolean;
}

export abstract class ZodSession<
	TEnv extends object = any,
	TData = any,
	TServerMessage = any,
	TClientMessage = any,
> extends BaseSession<TEnv, TData, TServerMessage, TClientMessage> {
	protected readonly clientCodec: ReturnType<typeof zodMsgpack<TClientMessage>>;
	protected readonly serverCodec: ReturnType<typeof zodMsgpack<TServerMessage>>;
	protected readonly enableBufferMessages: boolean;

	constructor(
		websocket: WebSocket,
		sessions: Map<
			WebSocket,
			ZodSession<TEnv, TData, TServerMessage, TClientMessage>
		>,
		protected options: ZodSessionOptions<TClientMessage, TServerMessage>,
	) {
		super(websocket, sessions);

		this.clientCodec = zodMsgpack(options.clientSchema);
		this.serverCodec = zodMsgpack(options.serverSchema);
		this.enableBufferMessages = options.enableBufferMessages ?? false;
	}

	// Override the base handleMessage to add validation
	async handleMessage(message: TClientMessage): Promise<void> {
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
			await this.handleValidatedMessage(validatedMessage);
		} catch (error) {
			console.error("Invalid client message received:", error);
			await this.handleValidationError(error, message);
		}
	}

	// Override buffer message handling to support msgpack decoding
	async handleBufferMessage(buffer: ArrayBuffer): Promise<void> {
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
			await this.handleValidatedMessage(decodedMessage);
		} catch (error) {
			console.error("Failed to decode buffer message:", error);
			await this.handleValidationError(error, buffer);
		}
	}

	// Type-safe send method that automatically uses the correct format
	protected send(message: TServerMessage): void {
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

	// Send a protocol error message (always as JSON for compatibility)
	private async sendProtocolError(errorMessage: string): Promise<void> {
		try {
			// Send a simple error object - no schema validation needed
			if (this.websocket.readyState !== WebSocket.OPEN) return;
			this.websocket.send(JSON.stringify({ error: errorMessage }));
		} catch (error) {
			console.error("Failed to send protocol error:", error);
		}
	}

	// Type-safe broadcast that validates server messages
	// Automatically uses the correct format based on session configuration
	protected broadcast(message: TServerMessage, excludeSelf = false): void {
		for (const session of this.sessions.values()) {
			if (excludeSelf && session === this) continue;
			if (session instanceof ZodSession) {
				session.send(message); // send() automatically uses correct format
			}
		}
	}

	// Abstract methods for implementers
	protected abstract handleValidatedMessage(
		message: TClientMessage,
	): Promise<void>;

	// Optional error handling - default implementation logs and continues
	protected async handleValidationError(
		error: unknown,
		originalMessage: unknown,
	): Promise<void> {
		console.error(
			"Validation error:",
			error,
			"Original message:",
			originalMessage,
		);
		// Implementers can override this to send error responses to clients
	}
}
