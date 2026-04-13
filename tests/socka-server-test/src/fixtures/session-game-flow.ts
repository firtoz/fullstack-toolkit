import type { InferSockaEventHandlers } from "socka/core";
import type { SockaRpc } from "socka/client";
import type { sessionGameContract } from "./session-game-contract";
import {
	SESSION_GAME_DAMAGE,
	SESSION_GAME_START_HEALTH,
} from "./session-game-state";

/** Bun `expect` / Vitest `expect` — minimal surface for shared flow assertions. */
export type SessionGameExpectFn = (actual: unknown) => {
	toBe(expected: unknown): void;
	toEqual(expected: unknown): void;
	toHaveLength(n: number): void;
};

/**
 * Builds the second client only after the one-player snapshot so both sockets
 * are not connecting concurrently before the second player appears in the roster.
 */
export async function assertSessionGameRosterGrowth(
	rpcA: SockaRpc<typeof sessionGameContract>,
	createRpcB: () =>
		| SockaRpc<typeof sessionGameContract>
		| Promise<SockaRpc<typeof sessionGameContract>>,
	expect: SessionGameExpectFn,
): Promise<SockaRpc<typeof sessionGameContract>> {
	await rpcA.client.waitForOpen();

	const onlyA = await rpcA.rpc.listPlayers();
	expect(onlyA.players).toHaveLength(1);
	expect(onlyA.self).toBe(onlyA.players[0].id);
	expect(onlyA.players[0].health).toBe(SESSION_GAME_START_HEALTH);

	const rpcB = await Promise.resolve(createRpcB());
	await rpcB.client.waitForOpen();

	const aView = await rpcA.rpc.listPlayers();
	const bView = await rpcB.rpc.listPlayers();
	expect(aView.players).toHaveLength(2);
	expect(bView.players).toEqual(aView.players);

	return rpcB;
}

export async function assertSessionGameCombat(
	rpcA: SockaRpc<typeof sessionGameContract>,
	rpcB: SockaRpc<typeof sessionGameContract>,
	expect: SessionGameExpectFn,
): Promise<void> {
	await rpcA.client.waitForOpen();
	await rpcB.client.waitForOpen();

	const aView = await rpcA.rpc.listPlayers();
	const idA = aView.self;
	const others = aView.players.filter((p) => p.id !== idA);
	expect(others).toHaveLength(1);
	const idB = others[0].id;

	const hit1 = await rpcA.rpc.attack({ target: idB });
	expect(hit1.gameOver).toBe(false);
	expect(hit1.targetHealth).toBe(
		SESSION_GAME_START_HEALTH - SESSION_GAME_DAMAGE,
	);

	const hit2 = await rpcB.rpc.attack({ target: idA });
	expect(hit2.gameOver).toBe(false);
	expect(hit2.targetHealth).toBe(
		SESSION_GAME_START_HEALTH - SESSION_GAME_DAMAGE,
	);

	const fin = await rpcA.rpc.attack({ target: idB });
	expect(fin.gameOver).toBe(true);
	expect(fin.winner).toBe(idA);
	expect(fin.targetHealth).toBe(0);

	const end = await rpcB.rpc.listPlayers();
	expect(end.players.find((p) => p.id === idB)?.health).toBe(0);
	expect(end.players.find((p) => p.id === idA)?.health).toBe(
		SESSION_GAME_START_HEALTH - SESSION_GAME_DAMAGE,
	);
}

/** Collect server push events for assertions (pass `handlers` into {@link SockaRpc}). */
export function createSessionGameEventCollector(): {
	playerJoined: Array<{ playerId: string }>;
	playerEliminated: Array<{ playerId: string; eliminatedBy: string }>;
	handlers: Partial<InferSockaEventHandlers<typeof sessionGameContract>>;
} {
	const playerJoined: Array<{ playerId: string }> = [];
	const playerEliminated: Array<{ playerId: string; eliminatedBy: string }> =
		[];
	return {
		playerJoined,
		playerEliminated,
		handlers: {
			playerJoined: (p) => {
				playerJoined.push(p);
			},
			playerEliminated: (p) => {
				playerEliminated.push(p);
			},
		},
	};
}

/**
 * Witness lists first (alone), then the peer connects; `onAttached` broadcasts
 * `playerJoined` to peers before the peer's first `listPlayers` (witness must
 * pass collector `eventHandlers` into {@link SockaRpc}).
 */
export async function assertSessionGamePlayerJoinedEvent(
	rpcWitness: SockaRpc<typeof sessionGameContract>,
	createRpcPeer: () =>
		| SockaRpc<typeof sessionGameContract>
		| Promise<SockaRpc<typeof sessionGameContract>>,
	witnessJoined: Array<{ playerId: string }>,
	expect: SessionGameExpectFn,
): Promise<SockaRpc<typeof sessionGameContract>> {
	await rpcWitness.client.waitForOpen();
	await rpcWitness.rpc.listPlayers();

	const rpcPeer = await Promise.resolve(createRpcPeer());
	await rpcPeer.client.waitForOpen();
	await Promise.resolve();
	await Promise.resolve();
	const peerFirst = await rpcPeer.rpc.listPlayers();
	expect(witnessJoined).toEqual([{ playerId: peerFirst.self }]);
	return rpcPeer;
}

/**
 * Connect and list in order (1 → 2 → 3 players), then `rpcAttacker` knocks out
 * the victim in two hits; `witness` should record `playerEliminated`.
 * Factories avoid opening sockets 2 and 3 before the prior player has listed.
 */
export async function assertSessionGameEliminationWitnessed(
	rpcAttacker: SockaRpc<typeof sessionGameContract>,
	createRpcVictim: () =>
		| SockaRpc<typeof sessionGameContract>
		| Promise<SockaRpc<typeof sessionGameContract>>,
	createRpcWitness: () =>
		| SockaRpc<typeof sessionGameContract>
		| Promise<SockaRpc<typeof sessionGameContract>>,
	witnessEliminated: Array<{ playerId: string; eliminatedBy: string }>,
	expect: SessionGameExpectFn,
): Promise<{
	rpcVictim: SockaRpc<typeof sessionGameContract>;
	rpcWitness: SockaRpc<typeof sessionGameContract>;
}> {
	await rpcAttacker.client.waitForOpen();
	const aView = await rpcAttacker.rpc.listPlayers();
	expect(aView.players).toHaveLength(1);

	const rpcVictim = await Promise.resolve(createRpcVictim());
	await rpcVictim.client.waitForOpen();
	const bView = await rpcVictim.rpc.listPlayers();
	expect(bView.players).toHaveLength(2);

	const rpcWitness = await Promise.resolve(createRpcWitness());
	await rpcWitness.client.waitForOpen();
	const wView = await rpcWitness.rpc.listPlayers();
	expect(wView.players).toHaveLength(3);

	const idA = aView.self;
	const idB = bView.self;
	expect(wView.self === idA).toBe(false);
	expect(wView.self === idB).toBe(false);

	const hit1 = await rpcAttacker.rpc.attack({ target: idB });
	expect(hit1.gameOver).toBe(false);

	const fin = await rpcAttacker.rpc.attack({ target: idB });
	expect(fin.gameOver).toBe(true);

	expect(witnessEliminated).toEqual([{ playerId: idB, eliminatedBy: idA }]);

	return { rpcVictim, rpcWitness };
}
