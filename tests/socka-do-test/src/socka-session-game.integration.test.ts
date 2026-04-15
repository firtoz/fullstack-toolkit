import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { InferSockaPushHandlers } from "@firtoz/socka/core";
import { SockaSession } from "@firtoz/socka/client";
import { sessionGameContract } from "../../socka-server-test/src/fixtures/session-game-contract";
import {
	assertSessionGameCombat,
	assertSessionGameEliminationWitnessed,
	assertSessionGamePlayerJoinedEvent,
	assertSessionGameRosterGrowth,
	createSessionGameEventCollector,
} from "../../socka-server-test/src/fixtures/session-game-flow";
import "./fixtures/worker";

async function openSessionGameRpc(
	stubSegment: string,
	options?: {
		pushHandlers?: Partial<InferSockaPushHandlers<typeof sessionGameContract>>;
	},
): Promise<SockaSession<typeof sessionGameContract>> {
	const response = await exports.default.fetch(
		`http://example.com/socka-session-game/${stubSegment}/websocket`,
		{ headers: { Upgrade: "websocket" } },
	);
	const ws = response.webSocket;
	if (!ws) throw new Error("expected webSocket");
	ws.accept();

	return new SockaSession({
		contract: sessionGameContract,
		webSocket: ws,
		wireFormat: "json",
		...options,
	});
}

describe("socka DO session game (shared arena)", () => {
	it("roster grows as each socket joins", async () => {
		const stubSegment = "session-game-roster";
		const rpcA = await openSessionGameRpc(stubSegment);
		const rpcB = await assertSessionGameRosterGrowth(
			rpcA,
			() => openSessionGameRpc(stubSegment),
			expect,
		);
		rpcA.client.close();
		rpcB.client.close();
	});

	it("two joined players: combat until knockout", async () => {
		const stubSegment = "session-game-combat";
		const rpcA = await openSessionGameRpc(stubSegment);
		const rpcB = await openSessionGameRpc(stubSegment);
		await assertSessionGameCombat(rpcA, rpcB, expect);
		rpcA.client.close();
		rpcB.client.close();
	});

	it("server events: playerJoined and playerEliminated reach peers", async () => {
		const stubJoined = "session-game-events-joined";
		const witnessEv = createSessionGameEventCollector();
		const rpcWitness = await openSessionGameRpc(stubJoined, {
			pushHandlers: witnessEv.handlers,
		});
		const rpcPeer = await assertSessionGamePlayerJoinedEvent(
			rpcWitness,
			() => openSessionGameRpc(stubJoined),
			witnessEv.playerJoined,
			expect,
		);
		rpcWitness.client.close();
		rpcPeer.client.close();

		const stubElim = "session-game-events-elim";
		const witnessElim = createSessionGameEventCollector();
		const rpcAttacker = await openSessionGameRpc(stubElim);
		const { rpcVictim, rpcWitness: rpcWitnessElim } =
			await assertSessionGameEliminationWitnessed(
				rpcAttacker,
				() => openSessionGameRpc(stubElim),
				() =>
					openSessionGameRpc(stubElim, {
						pushHandlers: witnessElim.handlers,
					}),
				witnessElim.playerEliminated,
				expect,
			);
		rpcAttacker.client.close();
		rpcVictim.client.close();
		rpcWitnessElim.client.close();
	});
});
