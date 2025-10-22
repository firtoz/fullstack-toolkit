import { BaseSession, BaseWebSocketDO } from "@firtoz/websocket-do";
import type { Context } from "hono";

// Message types for our test chat room
export type ClientMessage =
	| { type: "message"; text: string }
	| { type: "setName"; name: string };

export type ServerMessage =
	| { type: "userJoined"; name: string; userId: string }
	| { type: "userLeft"; name: string; userId: string }
	| { type: "message"; text: string; from: string; userId: string }
	| { type: "nameChanged"; oldName: string; newName: string; userId: string }
	| { type: "error"; message: string };

export type SessionData = {
	userId: string;
	name: string;
	joinedAt: number;
};

class ChatRoomSession extends BaseSession<
	SessionData,
	ServerMessage,
	ClientMessage,
	Env
> {
	constructor(websocket: WebSocket, sessions: Map<WebSocket, ChatRoomSession>) {
		super(websocket, sessions, {
			createData: (_ctx: Context<{ Bindings: Env }>) => ({
				userId: crypto.randomUUID(),
				name: `User-${Date.now()}`,
				joinedAt: Date.now(),
			}),
			handleMessage: async (message: ClientMessage) => {
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
			handleBufferMessage: async (_message: ArrayBuffer) => {
				this.send({
					type: "error",
					message: "Binary messages not supported",
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

// Durable Object implementation for testing
export class ChatRoomDO extends BaseWebSocketDO<
	BaseSession<SessionData, ServerMessage, ClientMessage>
> {
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

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			createSession: (_ctx, websocket) => {
				return new ChatRoomSession(websocket, this.sessions);
			},
		});
	}
}
