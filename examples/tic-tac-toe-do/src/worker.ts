import { Hono } from "hono";
import { TicTacToeDO } from "./do";

const app = new Hono<{ Bindings: Env }>();

app.all("/ws/:roomId", async (c) => {
	const roomId = c.req.param("roomId") ?? "default";
	const id = c.env.TIC_TAC_TOE.idFromName(roomId);
	const stub = c.env.TIC_TAC_TOE.get(id);
	const url = new URL(c.req.url);
	url.pathname = "/websocket";
	return stub.fetch(new Request(url.toString(), c.req.raw));
});

export { TicTacToeDO };
export default app;
