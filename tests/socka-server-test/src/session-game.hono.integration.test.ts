import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import type { SockaWireFormat } from "socka/core";
import { SockaRpc } from "socka/client";
import { sockaHonoNodeWs } from "socka/hono";
import { sessionGameContract } from "./fixtures/session-game-contract";
import {
	assertSessionGameCombat,
	assertSessionGameRosterGrowth,
} from "./fixtures/session-game-flow";
import {
	createSessionGameHandlers,
	createSessionGameWorld,
} from "./fixtures/session-game-state";

function startSessionGameHonoServer(wireFormat: SockaWireFormat): {
	server: ReturnType<typeof serve>;
	port: number;
	world: ReturnType<typeof createSessionGameWorld>;
} {
	const world = createSessionGameWorld();
	const { handlers, createData, onAttached } = createSessionGameHandlers(world);

	const app = new Hono();
	const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

	app.get(
		"/ws",
		upgradeWebSocket(
			sockaHonoNodeWs({
				contract: sessionGameContract,
				wireFormat,
				handlers,
				createData,
				handleClose: async () => {},
				onAttached,
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
	return { server, port: addr.port, world };
}

describe("socka/server session + shared state (dynamic roster) — Hono @hono/node-ws", () => {
	let json: ReturnType<typeof startSessionGameHonoServer>;
	let msgpack: ReturnType<typeof startSessionGameHonoServer>;

	beforeAll(() => {
		json = startSessionGameHonoServer("json");
		msgpack = startSessionGameHonoServer("msgpack");
	});

	afterAll(() => {
		json.server.close();
		msgpack.server.close();
	});

	test("JSON: roster grows; combat until knockout", async () => {
		json.world.reset();
		const rpcA = new SockaRpc({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${json.port}/ws`,
			wireFormat: "json",
		});
		const rpcB = await assertSessionGameRosterGrowth(
			rpcA,
			() =>
				new SockaRpc({
					contract: sessionGameContract,
					url: `ws://127.0.0.1:${json.port}/ws`,
					wireFormat: "json",
				}),
			expect,
		);
		rpcA.client.close();
		rpcB.client.close();

		json.world.reset();
		const rpcA2 = new SockaRpc({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${json.port}/ws`,
			wireFormat: "json",
		});
		const rpcB2 = new SockaRpc({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${json.port}/ws`,
			wireFormat: "json",
		});
		await assertSessionGameCombat(rpcA2, rpcB2, expect);
		rpcA2.client.close();
		rpcB2.client.close();
	});

	test("msgpack: roster grows; combat until knockout", async () => {
		msgpack.world.reset();
		const rpcA = new SockaRpc({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${msgpack.port}/ws`,
			wireFormat: "msgpack",
		});
		const rpcB = await assertSessionGameRosterGrowth(
			rpcA,
			() =>
				new SockaRpc({
					contract: sessionGameContract,
					url: `ws://127.0.0.1:${msgpack.port}/ws`,
					wireFormat: "msgpack",
				}),
			expect,
		);
		rpcA.client.close();
		rpcB.client.close();

		msgpack.world.reset();
		const rpcA2 = new SockaRpc({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${msgpack.port}/ws`,
			wireFormat: "msgpack",
		});
		const rpcB2 = new SockaRpc({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${msgpack.port}/ws`,
			wireFormat: "msgpack",
		});
		await assertSessionGameCombat(rpcA2, rpcB2, expect);
		rpcA2.client.close();
		rpcB2.client.close();
	});
});
