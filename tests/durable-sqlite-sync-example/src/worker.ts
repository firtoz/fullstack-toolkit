import { Hono } from "hono";
import { TodoSyncDO } from "./TodoSyncDO";

const app = new Hono<{ Bindings: Env }>();

app.all("/room/:roomId/*", async (c) => {
	const roomId = c.req.param("roomId");
	const stub = c.env.TODO_SYNC.getByName(roomId);

	const url = new URL(c.req.url);
	const path = url.pathname.replace(`/room/${roomId}`, "");
	url.pathname = path || "/";

	return stub.fetch(new Request(url.toString(), c.req.raw));
});

app.get("/", (c) => c.text("todo-sync-worker"));

export default app;
export { TodoSyncDO };
