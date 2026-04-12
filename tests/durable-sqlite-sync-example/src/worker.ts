import { type Context, Hono } from "hono";
import { TodoSyncDO } from "./TodoSyncDO";
import { VirtualPropsDrizzleDO } from "./VirtualPropsDrizzleDO";
import { VirtualPropsTanstackDO } from "./VirtualPropsTanstackDO";
import { VirtualPropsWsDrizzleDO } from "./VirtualPropsWsDrizzleDO";
import { VirtualPropsWsTanstackDO } from "./VirtualPropsWsTanstackDO";

/** Strip the worker route prefix so the DO sees paths like `/messages` or `/websocket`. */
function forwardToNamedRoomDo(
	c: Context<{ Bindings: Env }>,
	routePrefix: string,
	stub: DurableObjectStub,
): Response | Promise<Response> {
	const roomId = c.req.param("roomId");
	const url = new URL(c.req.url);
	const path = url.pathname.replace(`${routePrefix}/${roomId}`, "");
	url.pathname = path || "/";
	return stub.fetch(new Request(url.toString(), c.req.raw));
}

const app = new Hono<{ Bindings: Env }>();

app.all("/room/:roomId/*", (c) =>
	forwardToNamedRoomDo(
		c,
		"/room",
		c.env.TODO_SYNC.getByName(c.req.param("roomId")),
	),
);

app.all("/vp/ts/:roomId/*", (c) =>
	forwardToNamedRoomDo(
		c,
		"/vp/ts",
		c.env.VIRTUAL_PROPS_TS_DO.getByName(c.req.param("roomId")),
	),
);

app.all("/vp/drizzle/:roomId/*", (c) =>
	forwardToNamedRoomDo(
		c,
		"/vp/drizzle",
		c.env.VIRTUAL_PROPS_DRIZZLE_DO.getByName(c.req.param("roomId")),
	),
);

app.all("/vp/ws-ts/:roomId/*", (c) =>
	forwardToNamedRoomDo(
		c,
		"/vp/ws-ts",
		c.env.VIRTUAL_PROPS_WS_TS_DO.getByName(c.req.param("roomId")),
	),
);

app.all("/vp/ws-drizzle/:roomId/*", (c) =>
	forwardToNamedRoomDo(
		c,
		"/vp/ws-drizzle",
		c.env.VIRTUAL_PROPS_WS_DRIZZLE_DO.getByName(c.req.param("roomId")),
	),
);

app.get("/", (c) => c.text("todo-sync-worker"));

export default app;
export {
	TodoSyncDO,
	VirtualPropsDrizzleDO,
	VirtualPropsTanstackDO,
	VirtualPropsWsDrizzleDO,
	VirtualPropsWsTanstackDO,
};
