import { SockaError } from "socka/core";
import type { InferSockaHandlers } from "socka/core";
import type { SockaWebSocketSession } from "socka/server";

/** Both portable and DO sessions expose {@link broadcastEvent} for server pushes. */
export type SessionGameBroadcastSession = {
	data: SessionGameSessionData;
	broadcastEvent(event: string, body: unknown, excludeSelf?: boolean): void;
};
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
	/**
	 * First `listPlayers` for this id returns `true` so the server can broadcast
	 * `playerJoined` to peers (subsequent calls return `false`).
	 */
	takeJoinBroadcastTurn(playerId: SessionGamePlayerId): boolean;
};

export function createSessionGameWorld(options?: {
	/** Prefix for generated ids, e.g. `"p"` → `p1`, `p2`, … */
	idPrefix?: string;
}): SessionGameWorld {
	const idPrefix = options?.idPrefix ?? "p";
	const players: SessionGamePlayer[] = [];
	const joinBroadcastDone = new Set<SessionGamePlayerId>();
	let seq = 0;

	return {
		players,
		reset(): void {
			players.length = 0;
			seq = 0;
			joinBroadcastDone.clear();
		},
		join(): SessionGamePlayerId {
			seq += 1;
			const id = `${idPrefix}${seq}`;
			players.push({ id, health: SESSION_GAME_START_HEALTH });
			return id;
		},
		takeJoinBroadcastTurn(playerId: SessionGamePlayerId): boolean {
			if (joinBroadcastDone.has(playerId)) return false;
			joinBroadcastDone.add(playerId);
			return true;
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

function findPlayer(
	world: SessionGameWorld,
	id: SessionGamePlayerId,
): SessionGamePlayer | undefined {
	return world.players.find((p) => p.id === id);
}

export function createSessionGameHandlers<
	TSession extends SessionGameBroadcastSession = SockaWebSocketSession<
		SessionGameContract,
		SessionGameSessionData
	>,
>(
	world: SessionGameWorld,
): {
	handlers: InferSockaHandlers<SessionGameContract, TSession>;
	createData: () => SessionGameSessionData;
} {
	const handlers: InferSockaHandlers<SessionGameContract, TSession> = {
		listPlayers(session) {
			const self = session.data.playerId;
			if (world.takeJoinBroadcastTurn(self)) {
				session.broadcastEvent("playerJoined", { playerId: self }, true);
			}
			return {
				self,
				players: world.players.map((p) => ({ id: p.id, health: p.health })),
			};
		},
		attack(input, session) {
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
				session.broadcastEvent(
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
	};
}
