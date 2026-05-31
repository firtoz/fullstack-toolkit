import { SockaWebSocketDO, type SockaDoSessionConfigInput } from "@firtoz/socka/do";
import { ticTacToeContract } from "./contract";
import { TicTacToeGame } from "./game";

type EmptySessionData = Record<string, never>;

export class TicTacToeDO extends SockaWebSocketDO<
	typeof ticTacToeContract,
	EmptySessionData,
	Env
> {
	protected readonly contract = ticTacToeContract;

	/** One game per Durable Object instance (one room). */
	readonly game = new TicTacToeGame();

	app = this.getBaseApp();

	protected buildSockaSessionConfig(): SockaDoSessionConfigInput<
		typeof ticTacToeContract,
		EmptySessionData,
		Env
	> {
		return {
			wireFormat: "json" as const,
			handlers: {
				join: async (session) => {
					const { player } = this.game.join(session.websocket);
					const snap = this.game.snapshot();
					await session.broadcastPush("stateChanged", snap);
					return { ...snap, you: player };
				},
				move: async (input, session) => {
					const snap = this.game.move(
						session.websocket,
						input.row,
						input.col,
					);
					await session.broadcastPush("stateChanged", snap);
					return snap;
				},
			},
			handleClose: async (session) => {
				this.game.release(session.websocket);
			},
		};
	}
}
