import { SockaError } from "socka/core";
import type { z } from "zod";
import { boardSchema } from "./contract";

export type Board = z.infer<typeof boardSchema>;

export type GameSnapshot = {
	board: Board;
	turn: "X" | "O";
	status: "waiting" | "playing" | "draw" | "x_wins" | "o_wins";
};

const LINES: ReadonlyArray<readonly [number, number, number]> = [
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8],
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8],
	[0, 4, 8],
	[2, 4, 6],
];

function emptyBoard(): Board {
	return ["", "", "", "", "", "", "", "", ""] as Board;
}

function checkWinner(board: Board, m: "X" | "O"): boolean {
	return LINES.some(([a, b, c]) => board[a] === m && board[b] === m && board[c] === m);
}

function boardFull(board: Board): boolean {
	return board.every((c) => c !== "");
}

/** One game table; two WebSocket slots (X and O). */
export class TicTacToeGame {
	private board: Board = emptyBoard();
	private readonly slots: { X: WebSocket | null; O: WebSocket | null } = {
		X: null,
		O: null,
	};
	private turn: "X" | "O" = "X";
	private status: GameSnapshot["status"] = "waiting";

	join(ws: WebSocket): { player: "X" | "O" } {
		if (!this.slots.X) {
			this.slots.X = ws;
			return { player: "X" };
		}
		if (!this.slots.O) {
			this.slots.O = ws;
			if (this.status === "waiting") this.status = "playing";
			return { player: "O" };
		}
		throw new SockaError("Room full (two players already connected)");
	}

	private markFor(ws: WebSocket): "X" | "O" | null {
		if (this.slots.X === ws) return "X";
		if (this.slots.O === ws) return "O";
		return null;
	}

	snapshot(you?: "X" | "O"): GameSnapshot & { you?: "X" | "O" } {
		const base: GameSnapshot = {
			board: [...this.board] as Board,
			turn: this.turn,
			status: this.status,
		};
		return you !== undefined ? { ...base, you } : base;
	}

	move(ws: WebSocket, row: number, col: number): GameSnapshot {
		const player = this.markFor(ws);
		if (!player) {
			throw new SockaError("Join the game before moving");
		}
		if (this.status !== "playing") {
			throw new SockaError("Game is not in progress");
		}
		if (this.turn !== player) {
			throw new SockaError("Not your turn");
		}
		const i = row * 3 + col;
		if (this.board[i] !== "") {
			throw new SockaError("Cell already taken");
		}
		const nextBoard = [...this.board] as Board;
		nextBoard[i] = player;
		this.board = nextBoard;

		if (checkWinner(this.board, player)) {
			this.status = player === "X" ? "x_wins" : "o_wins";
		} else if (boardFull(this.board)) {
			this.status = "draw";
		} else {
			this.turn = player === "X" ? "O" : "X";
		}
		return this.snapshot();
	}

	release(ws: WebSocket): void {
		if (this.slots.X === ws) this.slots.X = null;
		if (this.slots.O === ws) this.slots.O = null;
		if (!this.slots.X && !this.slots.O) {
			this.board = emptyBoard();
			this.turn = "X";
			this.status = "waiting";
		}
	}
}
