import { SockaDoSession, SockaWebSocketDO } from "socka/do";
import { ticTacToeContract } from "./contract";
import { TicTacToeGame } from "./game";

type EmptySessionData = Record<string, never>;

export class TicTacToeSockaSession extends SockaDoSession<
	typeof ticTacToeContract,
	EmptySessionData,
	Env
> {
	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, TicTacToeSockaSession>,
		game: TicTacToeGame,
	) {
		super(websocket, sessions, {
			contract: ticTacToeContract,
			wireFormat: "json",
			handlers: {
				join: async (session) => {
					const { player } = game.join(session.websocket);
					const snap = game.snapshot();
					await session.broadcastContractEvent("stateChanged", snap);
					return { ...snap, you: player };
				},
				move: async (input, session) => {
					const snap = game.move(
						session.websocket,
						input.row,
						input.col,
					);
					await session.broadcastContractEvent("stateChanged", snap);
					return snap;
				},
			},
			handleClose: async () => {
				game.release(websocket);
			},
		});
	}
}

export class TicTacToeDO extends SockaWebSocketDO<TicTacToeSockaSession, Env> {
	/** One game per Durable Object instance (one room). */
	readonly game = new TicTacToeGame();

	app = this.getBaseApp();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			createSockaSession: (_ctx, websocket) =>
				new TicTacToeSockaSession(
					websocket,
					this.sessions as Map<WebSocket, TicTacToeSockaSession>,
					this.game,
				),
		});
	}
}
