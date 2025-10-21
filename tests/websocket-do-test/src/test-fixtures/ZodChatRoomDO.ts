import {
	ZodSession,
	type ZodSessionOptions,
	ZodWebSocketDO,
} from "@firtoz/websocket-do";
import type { Context } from "hono";
import { z } from "zod";

// Shared validation schemas - DRY principle
const nameSchema = z.string().min(1).max(50);
const textSchema = z.string().min(1).max(1000);
const userIdSchema = z.string().max(100); // UUIDs, IDs, etc.
const errorMessageSchema = z.string().max(500);

const l = z.literal;

// Zod schemas for message validation
export const ClientMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: l("message"),
		text: textSchema,
	}),
	z.object({
		type: l("setName"),
		name: nameSchema,
	}),
]);

export const ServerMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: l("userJoined"),
		name: nameSchema, // Consistent limits
		userId: userIdSchema,
	}),
	z.object({
		type: l("userLeft"),
		name: nameSchema,
		userId: userIdSchema,
	}),
	z.object({
		type: l("message"),
		text: textSchema, // Consistent limits
		from: nameSchema,
		userId: userIdSchema,
	}),
	z.object({
		type: l("nameChanged"),
		oldName: nameSchema,
		newName: nameSchema,
		userId: userIdSchema,
	}),
	z.object({
		type: l("error"),
		message: errorMessageSchema,
	}),
]);

// Infer types from schemas
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export interface SessionData {
	userId: string;
	name: string;
	joinedAt: number;
}

// ZodSession implementation for testing
export class ZodChatSession extends ZodSession<
	SessionData,
	ServerMessage,
	ClientMessage,
	Env
> {
	protected createData(_ctx: Context<{ Bindings: Env }>): SessionData {
		return {
			userId: crypto.randomUUID(),
			name: `User-${Date.now()}`,
			joinedAt: Date.now(),
		};
	}

	protected async handleValidatedMessage(
		message: ClientMessage,
	): Promise<void> {
		switch (message.type) {
			case "message":
				// Broadcast message to all sessions
				this.broadcast({
					type: "message",
					text: message.text,
					from: this.data.name,
					userId: this.data.userId,
				});
				break;

			case "setName": {
				const oldName = this.data.name;
				this.data.name = message.name;
				this.update();

				// Broadcast name change
				this.broadcast({
					type: "nameChanged",
					oldName,
					newName: message.name,
					userId: this.data.userId,
				});
				break;
			}
		}
	}

	// Override to send error messages to clients for validation errors
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

		this.send({
			type: "error",
			message: "Invalid message format",
		});
	}

	async handleClose(): Promise<void> {
		// Broadcast that user left
		this.broadcast(
			{
				type: "userLeft",
				name: this.data.name,
				userId: this.data.userId,
			},
			true, // exclude self
		);
	}
}

// ZodWebSocketDO implementation for testing
export class ZodChatRoomDO extends ZodWebSocketDO<ZodChatSession> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			clientSchema: ClientMessageSchema,
			serverSchema: ServerMessageSchema,
			enableBufferMessages: true, // Enable msgpack buffer messages
		});
	}

	app = this.getBaseApp().post("/info", (c) => {
		return c.json({
			sessionCount: this.sessions.size,
			sessions: Array.from(this.sessions.values()).map((session) => ({
				userId: session.data.userId,
				name: session.data.name,
				joinedAt: session.data.joinedAt,
			})),
		});
	});

	protected createZodSession(
		_ctx: Context<{ Bindings: Env }> | undefined,
		websocket: WebSocket,
		options: ZodSessionOptions<ClientMessage, ServerMessage>,
	): ZodChatSession {
		return new ZodChatSession(websocket, this.sessions, options);
	}
}
