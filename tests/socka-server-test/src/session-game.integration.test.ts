import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import type { AddressInfo } from "node:net";
import { SockaRpc } from "socka/client";
import { attachSockaWebSocket } from "socka/server";
import type { SockaWebSocketSession } from "socka/server";
import type { WebSocket as NodeWebSocket } from "ws";
import { WebSocketServer } from "ws";
import {
	sessionGameContract,
	type SessionGameContract,
} from "./fixtures/session-game-contract";
import {
	assertSessionGameCombat,
	assertSessionGameEliminationWitnessed,
	assertSessionGamePlayerJoinedEvent,
	assertSessionGameRosterGrowth,
	createSessionGameEventCollector,
} from "./fixtures/session-game-flow";
import {
	createSessionGameHandlers,
	createSessionGameWorld,
	type SessionGameSessionData,
} from "./fixtures/session-game-state";

async function listenWss(): Promise<{ wss: WebSocketServer; port: number }> {
	return new Promise((resolve, reject) => {
		const wss = new WebSocketServer({ port: 0 });
		wss.once("listening", () => {
			const addr = wss.address();
			if (typeof addr === "string" || addr === null) {
				reject(new Error("expected socket port"));
				return;
			}
			resolve({ wss, port: (addr as AddressInfo).port });
		});
		wss.once("error", reject);
	});
}

function closeWss(wss: WebSocketServer): Promise<void> {
	return new Promise((resolve, reject) => {
		wss.close((err: Error | undefined) => {
			if (err) reject(err);
			else resolve();
		});
	});
}

describe("socka/server session + shared state (dynamic roster) — Node ws", () => {
	let wss: WebSocketServer;
	let port: number;
	const world = createSessionGameWorld();

	const sessions = new Map<
		globalThis.WebSocket,
		SockaWebSocketSession<SessionGameContract, SessionGameSessionData>
	>();

	beforeEach(() => {
		world.reset();
	});

	beforeAll(async () => {
		const { handlers, createData } = createSessionGameHandlers(world);

		const started = await listenWss();
		wss = started.wss;
		port = started.port;

		wss.on("connection", (ws: NodeWebSocket) => {
			attachSockaWebSocket(ws as unknown as globalThis.WebSocket, sessions, {
				contract: sessionGameContract,
				wireFormat: "json",
				handlers,
				createData,
				handleClose: async () => {},
			});
		});
	});

	afterAll(async () => {
		await closeWss(wss);
	});

	test("roster grows as each socket joins (empty → one → two)", async () => {
		const rpcA = new SockaRpc({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${port}`,
			wireFormat: "json",
		});

		const rpcB = await assertSessionGameRosterGrowth(
			rpcA,
			() =>
				new SockaRpc({
					contract: sessionGameContract,
					url: `ws://127.0.0.1:${port}`,
					wireFormat: "json",
				}),
			expect,
		);

		rpcA.client.close();
		rpcB.client.close();
	});

	test("two joined players: distinct self; shared health updates until knockout", async () => {
		const rpcA = new SockaRpc({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${port}`,
			wireFormat: "json",
		});
		const rpcB = new SockaRpc({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${port}`,
			wireFormat: "json",
		});

		await assertSessionGameCombat(rpcA, rpcB, expect);

		rpcA.client.close();
		rpcB.client.close();
	});

	test("server events: witness hears playerJoined when peer lists", async () => {
		const witnessEv = createSessionGameEventCollector();
		const rpcWitness = new SockaRpc({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${port}`,
			wireFormat: "json",
			eventHandlers: witnessEv.handlers,
		});

		const rpcPeer = await assertSessionGamePlayerJoinedEvent(
			rpcWitness,
			() =>
				new SockaRpc({
					contract: sessionGameContract,
					url: `ws://127.0.0.1:${port}`,
					wireFormat: "json",
				}),
			witnessEv.playerJoined,
			expect,
		);

		rpcWitness.client.close();
		rpcPeer.client.close();
	});

	test("server events: third player hears playerEliminated when another is knocked out", async () => {
		const witnessEv = createSessionGameEventCollector();
		const rpcAttacker = new SockaRpc({
			contract: sessionGameContract,
			url: `ws://127.0.0.1:${port}`,
			wireFormat: "json",
		});

		const { rpcVictim, rpcWitness } =
			await assertSessionGameEliminationWitnessed(
				rpcAttacker,
				() =>
					new SockaRpc({
						contract: sessionGameContract,
						url: `ws://127.0.0.1:${port}`,
						wireFormat: "json",
					}),
				() =>
					new SockaRpc({
						contract: sessionGameContract,
						url: `ws://127.0.0.1:${port}`,
						wireFormat: "json",
						eventHandlers: witnessEv.handlers,
					}),
				witnessEv.playerEliminated,
				expect,
			);

		rpcAttacker.client.close();
		rpcVictim.client.close();
		rpcWitness.client.close();
	});
});
