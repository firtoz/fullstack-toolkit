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

export interface SessionData {
	userId: string;
	name: string;
	joinedAt: number;
}

// Session implementation for testing
export class ChatSession extends BaseSession<
	Env,
	SessionData,
	ServerMessage,
	ClientMessage
> {
	protected createData(_ctx: Context<{ Bindings: Env }>): SessionData {
		return {
			userId: crypto.randomUUID(),
			name: `User-${Date.now()}`,
			joinedAt: Date.now(),
		};
	}

	async handleMessage(message: ClientMessage): Promise<void> {
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

	async handleBufferMessage(_message: ArrayBuffer): Promise<void> {
		this.send({
			type: "error",
			message: "Binary messages not supported",
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

// Durable Object implementation for testing
export class ChatRoomDO extends BaseWebSocketDO<Env, ChatSession> {
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

	protected createSession(websocket: WebSocket): ChatSession {
		return new ChatSession(websocket, this.sessions);
	}
}
