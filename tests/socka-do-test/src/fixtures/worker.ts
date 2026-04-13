import { Hono } from "hono";
import { SockaJsonTestDO } from "./SockaJsonTestDO";
import { SockaMsgpackTestDO } from "./SockaMsgpackTestDO";

const app = new Hono<{ Bindings: Env }>();

app.all("/socka-json/*", async (c) => {
	const stub = c.env.SOCKA_JSON_TEST.getByName("socka-json-test");
	const url = new URL(c.req.url);
	const path = url.pathname.replace("/socka-json", "");
	url.pathname = path || "/";
	return stub.fetch(new Request(url.toString(), c.req.raw));
});

app.all("/socka-msgpack/*", async (c) => {
	const stub = c.env.SOCKA_MSGPACK_TEST.getByName("socka-msgpack-test");
	const url = new URL(c.req.url);
	const path = url.pathname.replace("/socka-msgpack", "");
	url.pathname = path || "/";
	return stub.fetch(new Request(url.toString(), c.req.raw));
});

app.get("/", (c) => c.text("socka-do-test worker"));

export default app;

export { SockaJsonTestDO, SockaMsgpackTestDO };
