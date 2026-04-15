import {
	StandardSchemaSession,
	type StandardSchemaSessionOptions,
	StandardSchemaWebSocketDO,
} from "@firtoz/websocket-do";
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

export type SessionData = {
	userId: string;
	name: string;
	joinedAt: number;
	format: "json" | "buffer"; // Track the format used for this session
};

class StandardSchemaChatRoomSession_Dynamic extends StandardSchemaSession<
	SessionData,
	ServerMessage,
	ClientMessage,
	Env
> {
	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, StandardSchemaChatRoomSession_Dynamic>,
		options: StandardSchemaSessionOptions<ClientMessage, ServerMessage>,
	) {
		super(websocket, sessions, options, {
			createData: (_ctx) => ({
				userId: crypto.randomUUID(),
				name: `User-${Date.now()}`,
				joinedAt: Date.now(),
				format: options.enableBufferMessages ? "buffer" : "json",
			}),
			handleValidatedMessage: async (message: ClientMessage) => {
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
			},
			handleValidationError: async (error, originalMessage) => {
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
			},
			handleClose: async () => {
				// Broadcast that user left
				this.broadcast(
					{
						type: "userLeft",
						name: this.data.name,
						userId: this.data.userId,
					},
					true, // exclude self
				);
			},
		});
	}
}

// StandardSchemaWebSocketDO implementation that switches format based on query param
export class StandardSchemaChatRoomDO_Dynamic extends StandardSchemaWebSocketDO<
	StandardSchemaSession<SessionData, ServerMessage, ClientMessage, Env>
> {
	app = this.getBaseApp().post("/info", (c) => {
		return c.json({
			sessionCount: this.sessions.size,
			sessions: Array.from(this.sessions.values()).map((session) => ({
				userId: session.data.userId,
				name: session.data.name,
				joinedAt: session.data.joinedAt,
				format: session.data.format,
			})),
		});
	});

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			// Pass a function that determines the format based on the query parameter
			standardSchemaSessionOptions: (honoCtx, _websocket) => {
				// Check query parameter to determine format
				const format = honoCtx?.req.query("format") ?? "json";
				const enableBufferMessages = format === "buffer";

				return {
					clientSchema: ClientMessageSchema,
					serverSchema: ServerMessageSchema,
					enableBufferMessages,
				};
			},
			createStandardSchemaSession: (_ctx, websocket, options) => {
				return new StandardSchemaChatRoomSession_Dynamic(
					websocket,
					this.sessions,
					options,
				);
			},
		});
	}
}
