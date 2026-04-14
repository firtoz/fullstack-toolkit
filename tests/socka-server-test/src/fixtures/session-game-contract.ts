import * as z from "zod";
import { defineSocka } from "socka/core";

const playerIdSchema = z.string().min(1);

/** Multi-session arena: list snapshot + attack by player id (used for session integration tests). */
export const sessionGameContract = defineSocka({
	calls: {
		listPlayers: {
			output: z.object({
				self: playerIdSchema,
				players: z.array(
					z.object({
						id: playerIdSchema,
						health: z.number().int().min(0),
					}),
				),
			}),
		},
		attack: {
			input: z.object({ target: playerIdSchema }),
			output: z.object({
				targetHealth: z.number().int().min(0),
				attackerHealth: z.number().int().min(0),
				gameOver: z.boolean(),
				winner: playerIdSchema.optional(),
			}),
		},
	},
	pushes: {
		/** Emitted to other sockets the first time this player runs `listPlayers` (join presence). */
		playerJoined: z.object({ playerId: playerIdSchema }),
		/** Emitted to every socket when a player is reduced to 0 health (including the victim). */
		playerEliminated: z.object({
			playerId: playerIdSchema,
			eliminatedBy: playerIdSchema,
		}),
	},
});

export type SessionGameContract = typeof sessionGameContract;

export type SessionGamePlayerId = z.infer<typeof playerIdSchema>;
