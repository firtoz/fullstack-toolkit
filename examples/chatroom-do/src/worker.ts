import { Hono } from "hono";
import { ChatRoomDO } from "./do";

const app = new Hono<{ Bindings: Env }>();

app.all("/ws/:roomId", async (c) => {
	const roomId = c.req.param("roomId") ?? "default";
	const id = c.env.CHAT_ROOM.idFromName(roomId);
	const stub = c.env.CHAT_ROOM.get(id);
	const url = new URL(c.req.url);
	url.pathname = "/websocket";
	return stub.fetch(new Request(url.toString(), c.req.raw));
});

export { ChatRoomDO };
export default app;
