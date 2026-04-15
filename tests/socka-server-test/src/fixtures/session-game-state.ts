import { SockaError } from "@firtoz/socka/core";
import type { InferSockaHandlers } from "@firtoz/socka/core";
import type { SockaPushSession } from "@firtoz/socka/server";
import type { SockaWebSocketSession } from "@firtoz/socka/server";
import type {
	SessionGameContract,
	SessionGamePlayerId,
} from "./session-game-contract";

export const SESSION_GAME_START_HEALTH = 6;
export const SESSION_GAME_DAMAGE = 3;

export type SessionGamePlayer = { id: SessionGamePlayerId; health: number };

/**
 * Shared arena: `players` starts empty; each join appends a player (see {@link SessionGameWorld.join}).
 * Reset clears the list and the id sequence so tests are isolated.
 */
export type SessionGameWorld = {
	readonly players: SessionGamePlayer[];
	reset(): void;
	/** Append a new player with fresh health; returns their id (call from `createData`). */
	join(): SessionGamePlayerId;
};

export function createSessionGameWorld(options?: {
	/** Prefix for generated ids, e.g. `"p"` → `p1`, `p2`, … */
	idPrefix?: string;
}): SessionGameWorld {
	const idPrefix = options?.idPrefix ?? "p";
	const players: SessionGamePlayer[] = [];
	let seq = 0;

	return {
		players,
		reset(): void {
			players.length = 0;
			seq = 0;
		},
		join(): SessionGamePlayerId {
			seq += 1;
			const id = `${idPrefix}${seq}`;
			players.push({ id, health: SESSION_GAME_START_HEALTH });
			return id;
		},
	};
}

export type SessionGameSessionData = { playerId: SessionGamePlayerId };

/** Portable `createData` / DO `createData` (ignore ctx): one join per new session. */
export function sessionGameCreateData(
	world: SessionGameWorld,
): () => SessionGameSessionData {
	return () => ({ playerId: world.join() });
}

/**
 * After the session is registered, broadcast `playerJoined` to peers (exclude self).
 * Pass as {@link SockaWebSocketSessionConfig.onAttached} or {@link SockaDoSessionConfig.onAttached}.
 */
export function createSessionGameOnAttached(_world: SessionGameWorld): (
	session: SockaPushSession<SessionGameContract> & {
		data: SessionGameSessionData;
	},
) => void | Promise<void> {
	return (session) => {
		void session.broadcastPush(
			"playerJoined",
			{ playerId: session.data.playerId },
			true,
		);
	};
}

function findPlayer(
	world: SessionGameWorld,
	id: SessionGamePlayerId,
): SessionGamePlayer | undefined {
	return world.players.find((p) => p.id === id);
}

export function createSessionGameHandlers<
	TSession extends SockaPushSession<SessionGameContract> & {
		data: SessionGameSessionData;
	} = SockaWebSocketSession<SessionGameContract, SessionGameSessionData>,
>(
	world: SessionGameWorld,
): {
	handlers: InferSockaHandlers<SessionGameContract, TSession>;
	createData: () => SessionGameSessionData;
	onAttached: (
		session: SockaPushSession<SessionGameContract> & {
			data: SessionGameSessionData;
		},
	) => void | Promise<void>;
} {
	const handlers: InferSockaHandlers<SessionGameContract, TSession> = {
		async listPlayers(session) {
			const self = session.data.playerId;
			return {
				self,
				players: world.players.map((p) => ({ id: p.id, health: p.health })),
			};
		},
		async attack(input, session) {
			const self = session.data.playerId;
			if (input.target === self) {
				throw new SockaError("cannot attack self");
			}
			const attacker = findPlayer(world, self);
			const target = findPlayer(world, input.target);
			if (!attacker || !target) {
				throw new SockaError("unknown player");
			}
			target.health = Math.max(0, target.health - SESSION_GAME_DAMAGE);
			const gameOver = target.health === 0;
			if (gameOver) {
				await session.broadcastPush(
					"playerEliminated",
					{ playerId: input.target, eliminatedBy: self },
					false,
				);
			}
			return {
				targetHealth: target.health,
				attackerHealth: attacker.health,
				gameOver,
				winner: gameOver ? self : undefined,
			};
		},
	};

	return {
		handlers,
		createData: sessionGameCreateData(world),
		onAttached: createSessionGameOnAttached(world),
	};
}
