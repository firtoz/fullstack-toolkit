import * as z from "zod";
import { defineSocka } from "@firtoz/socka/core";

const mark = z.enum(["", "X", "O"]);
export const boardSchema = z.tuple([
	mark,
	mark,
	mark,
	mark,
	mark,
	mark,
	mark,
	mark,
	mark,
]);

const statusSchema = z.enum([
	"waiting",
	"playing",
	"draw",
	"x_wins",
	"o_wins",
]);

const snapshotSchema = z.object({
	board: boardSchema,
	turn: z.enum(["X", "O"]),
	status: statusSchema,
});

export const ticTacToeContract = defineSocka({
	calls: {
		join: {
			output: snapshotSchema.extend({
				you: z.enum(["X", "O"]),
			}),
		},
		move: {
			input: z.object({
				row: z.number().int().min(0).max(2),
				col: z.number().int().min(0).max(2),
			}),
			output: snapshotSchema,
		},
	},
	pushes: {
		stateChanged: snapshotSchema,
	},
});

export type TicTacToeContract = typeof ticTacToeContract;
