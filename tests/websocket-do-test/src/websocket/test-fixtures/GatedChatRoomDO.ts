import { BaseSession, BaseWebSocketDO } from "@firtoz/websocket-do";
import type { Context } from "hono";

type GatedClientMessage = { type: "ping" };
type GatedServerMessage = { type: "pong" };
type GatedSessionData = { ok: true };

class GatedSession extends BaseSession<
	GatedSessionData,
	GatedServerMessage,
	GatedClientMessage,
	Env
> {
	constructor(websocket: WebSocket, sessions: Map<WebSocket, GatedSession>) {
		super(websocket, sessions, {
			createData: (_ctx: Context<{ Bindings: Env }>) => ({ ok: true }),
			handleMessage: async () => {},
			handleBufferMessage: async () => {},
			handleClose: async () => {},
		});
	}
}

/** DO fixture: rejects WebSocket upgrade unless `X-Test-Auth: ok` is present. */
export class GatedChatRoomDO extends BaseWebSocketDO<GatedSession> {
	app = this.getBaseApp();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			createSession: (_ctx, websocket) =>
				new GatedSession(websocket, this.sessions),
		});
	}

	protected override beforeWebSocket(
		ctx: Context<{ Bindings: Env }>,
	): Response | undefined {
		if (ctx.req.header("X-Test-Auth") !== "ok") {
			return ctx.text("Unauthorized", 401);
		}
	}
}
