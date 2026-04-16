import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { SockaWireFormat } from "@firtoz/socka/core";
import { SockaSession } from "@firtoz/socka/client";
import { createSockaBunWebSocketHandlers } from "@firtoz/socka/bun";
import { sessionGameContract } from "./fixtures/session-game-contract";
import {
	assertSessionGameCombat,
	assertSessionGameRosterGrowth,
} from "./fixtures/session-game-flow";
import {
	createSessionGameHandlers,
	createSessionGameWorld,
} from "./fixtures/session-game-state";

function startSessionGameBunServer(wireFormat: SockaWireFormat): {
	server: ReturnType<typeof Bun.serve>;
	port: number;
	world: ReturnType<typeof createSessionGameWorld>;
} {
	const world = createSessionGameWorld();
	const { handlers, createData, onAttached } = createSessionGameHandlers(world);

	const { websocket } = createSockaBunWebSocketHandlers({
		strictUpgradeRequest: false,
		contract: sessionGameContract,
		wireFormat,
		handlers,
		createData,
		handleClose: async () => {},
		onAttached,
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
	return { server, port, world };
}

describe("@firtoz/socka/server session + shared state (dynamic roster) — Bun.serve", () => {
	let json: ReturnType<typeof startSessionGameBunServer>;
	let msgpack: ReturnType<typeof startSessionGameBunServer>;

	beforeAll(() => {
		json = startSessionGameBunServer("json");
		msgpack = startSessionGameBunServer("msgpack");
	});

	afterAll(() => {
		json.server.stop();
		msgpack.server.stop();
	});

	test("JSON: roster grows; combat until knockout", async () => {
		json.world.reset();
		const rpcA = new SockaSession({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${json.port}`,
			wireFormat: "json",
		});
		const rpcB = await assertSessionGameRosterGrowth(
			rpcA,
			() =>
				new SockaSession({
					contract: sessionGameContract,
					url: `ws://127.0.0.1:${json.port}`,
					wireFormat: "json",
				}),
			expect,
		);
		rpcA.client.close();
		rpcB.client.close();

		json.world.reset();
		const rpcA2 = new SockaSession({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${json.port}`,
			wireFormat: "json",
		});
		const rpcB2 = new SockaSession({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${json.port}`,
			wireFormat: "json",
		});
		await assertSessionGameCombat(rpcA2, rpcB2, expect);
		rpcA2.client.close();
		rpcB2.client.close();
	});

	test("msgpack: roster grows; combat until knockout", async () => {
		msgpack.world.reset();
		const rpcA = new SockaSession({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${msgpack.port}`,
			wireFormat: "msgpack",
		});
		const rpcB = await assertSessionGameRosterGrowth(
			rpcA,
			() =>
				new SockaSession({
					contract: sessionGameContract,
					url: `ws://127.0.0.1:${msgpack.port}`,
					wireFormat: "msgpack",
				}),
			expect,
		);
		rpcA.client.close();
		rpcB.client.close();

		msgpack.world.reset();
		const rpcA2 = new SockaSession({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${msgpack.port}`,
			wireFormat: "msgpack",
		});
		const rpcB2 = new SockaSession({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${msgpack.port}`,
			wireFormat: "msgpack",
		});
		await assertSessionGameCombat(rpcA2, rpcB2, expect);
		rpcA2.client.close();
		rpcB2.client.close();
	});
});
