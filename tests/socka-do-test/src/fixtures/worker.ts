import { Hono } from "hono";
import { upgradeWebSocket } from "hono/cloudflare-workers";
import { sockaHonoCloudflare } from "@firtoz/socka/hono/cloudflare";
import { SockaJsonTestDO } from "./SockaJsonTestDO";
import { SockaMsgpackTestDO } from "./SockaMsgpackTestDO";
import { SockaSessionGameTestDO } from "./SockaSessionGameTestDO";
import { roundtripContract } from "./roundtrip-contract";
import { roundtripHandlers } from "./roundtrip-handlers";

const app = new Hono<{ Bindings: Env }>();

app.get(
	"/hono-socka-ws",
	upgradeWebSocket(
		sockaHonoCloudflare({
			contract: roundtripContract,
			handlers: roundtripHandlers,
			handleClose: async () => {},
			createData: () => ({}),
		}),
	),
);

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

app.all("/socka-session-game/:stubName/*", async (c) => {
	const stubName = c.req.param("stubName");
	const stub = c.env.SOCKA_SESSION_GAME_TEST.getByName(stubName);
	const url = new URL(c.req.url);
	const path = url.pathname.replace(`/socka-session-game/${stubName}`, "");
	url.pathname = path || "/";
	return stub.fetch(new Request(url.toString(), c.req.raw));
});

app.get("/", (c) => c.text("socka-do-test worker"));

export default app;

export { SockaJsonTestDO, SockaMsgpackTestDO, SockaSessionGameTestDO };
