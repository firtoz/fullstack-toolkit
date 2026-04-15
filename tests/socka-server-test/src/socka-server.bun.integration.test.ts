import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SockaError } from "socka/core";
import type { SockaWireFormat } from "socka/core";
import { SockaSession } from "socka/client";
import { createSockaBunWebSocketHandlers } from "socka/bun";
import { roundtripContract } from "./fixtures/roundtrip-contract";
import { roundtripHandlers } from "./fixtures/roundtrip-handlers";

function startBunSockaServer(wireFormat: SockaWireFormat): {
	server: ReturnType<typeof Bun.serve>;
	port: number;
} {
	const { websocket } = createSockaBunWebSocketHandlers({
		contract: roundtripContract,
		wireFormat,
		handlers: roundtripHandlers,
		handleClose: async () => {},
		createData: () => ({}),
	});

	const server = Bun.serve({
		port: 0,
		fetch(req, srv) {
			if (srv.upgrade(req)) {
				return;
			}
			return new Response("not found", { status: 404 });
		},
		websocket,
	});

	const port = server.port;
	if (port === undefined) {
		throw new Error("Bun.serve: expected port");
	}
	return { server, port };
}

describe("socka/server e2e (Bun.serve)", () => {
	let json: ReturnType<typeof startBunSockaServer>;
	let msgpack: ReturnType<typeof startBunSockaServer>;

	beforeAll(() => {
		json = startBunSockaServer("json");
		msgpack = startBunSockaServer("msgpack");
	});

	afterAll(() => {
		json.server.stop();
		msgpack.server.stop();
	});

	test("JSON: echo and ping", async () => {
		const rpc = new SockaSession({
			contract: roundtripContract,
			url: `ws://127.0.0.1:${json.port}`,
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
			url: `ws://127.0.0.1:${json.port}`,
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
			url: `ws://127.0.0.1:${msgpack.port}`,
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
