import {
	SockaWebSocketDO,
	type SockaDoSession,
	type SockaDoSessionConfigInput,
} from "@firtoz/socka/do";
import type { Context } from "hono";
import {
	createSessionGameHandlers,
	createSessionGameWorld,
	type SessionGameSessionData,
} from "../../../socka-server-test/src/fixtures/session-game-state";
import { sessionGameContract } from "../../../socka-server-test/src/fixtures/session-game-contract";

export class SockaSessionGameTestDO extends SockaWebSocketDO<
	typeof sessionGameContract,
	SessionGameSessionData,
	Env
> {
	protected readonly contract = sessionGameContract;
	app = this.getBaseApp();

	/** One arena per DO — shared by all sockets attached to this instance. */
	readonly world = createSessionGameWorld();

	protected buildSockaSessionConfig(): SockaDoSessionConfigInput<
		typeof sessionGameContract,
		SessionGameSessionData,
		Env
	> {
		const { handlers, createData, onAttached } = createSessionGameHandlers<
			SockaDoSession<typeof sessionGameContract, SessionGameSessionData, Env>
		>(this.world);
		return {
			wireFormat: "json" as const,
			handlers,
			handleClose: async () => {},
			createData: (_ctx: Context<{ Bindings: Env }>) => createData(),
			onAttached,
		};
	}
}
