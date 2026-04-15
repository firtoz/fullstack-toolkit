import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { SockaError } from "socka/core";
import type { SockaWireFormat } from "socka/core";
import { SockaSession } from "socka/client";
import { sockaHonoNodeWs } from "socka/hono";
import { roundtripContract } from "./fixtures/roundtrip-contract";
import { roundtripHandlers } from "./fixtures/roundtrip-handlers";

function startHonoSockaServer(wireFormat: SockaWireFormat): {
	server: ReturnType<typeof serve>;
	port: number;
} {
	const app = new Hono();
	const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

	app.get(
		"/ws",
		upgradeWebSocket(
			sockaHonoNodeWs({
				contract: roundtripContract,
				wireFormat,
				handlers: roundtripHandlers,
				handleClose: async () => {},
				createData: () => ({}),
			}),
		),
	);

	const server = serve({
		fetch: app.fetch,
		port: 0,
	});
	injectWebSocket(server);

	const addr = server.address();
	if (addr === null || typeof addr === "string") {
		throw new Error("expected bound address with port");
	}
	return { server, port: addr.port };
}

describe("socka/hono (Node @hono/node-ws)", () => {
	let json: ReturnType<typeof startHonoSockaServer>;
	let msgpack: ReturnType<typeof startHonoSockaServer>;

	beforeAll(() => {
		json = startHonoSockaServer("json");
		msgpack = startHonoSockaServer("msgpack");
	});

	afterAll(() => {
		json.server.close();
		msgpack.server.close();
	});

	test("JSON: echo and ping", async () => {
		const rpc = new SockaSession({
			contract: roundtripContract,
			url: `ws://127.0.0.1:${json.port}/ws`,
			wireFormat: "json",
		});
		await rpc.client.waitForOpen();

		await expect(rpc.send.echo({ text: "hello" })).resolves.toEqual({
			text: "hello",
		});
		await expect(rpc.send.ping()).resolves.toEqual({ pong: true });

		rpc.client.close();
	});

	test("JSON: handler SockaError surfaces on client", async () => {
		const rpc = new SockaSession({
			contract: roundtripContract,
			url: `ws://127.0.0.1:${json.port}/ws`,
			wireFormat: "json",
		});
		await rpc.client.waitForOpen();

		const err = await rpc.send.fail().catch((e: unknown) => e);
		expect(err).toBeInstanceOf(SockaError);
		expect((err as SockaError).message).toBe("intentional failure");

		rpc.client.close();
	});

	test("msgpack: echo and ping", async () => {
		const rpc = new SockaSession({
			contract: roundtripContract,
			url: `ws://127.0.0.1:${msgpack.port}/ws`,
			wireFormat: "msgpack",
		});
		await rpc.client.waitForOpen();

		await expect(rpc.send.echo({ text: "bin" })).resolves.toEqual({
			text: "bin",
		});
		await expect(rpc.send.ping()).resolves.toEqual({ pong: true });

		rpc.client.close();
	});
});
