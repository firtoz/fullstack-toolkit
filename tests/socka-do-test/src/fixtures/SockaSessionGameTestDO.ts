import { SockaWebSocketDO } from "@firtoz/socka/do";
import { createSessionGameWorld } from "../../../socka-server-test/src/fixtures/session-game-state";
import { SockaSessionGameSession } from "./SockaSessionGameSession";

export class SockaSessionGameTestDO extends SockaWebSocketDO<
	SockaSessionGameSession,
	Env
> {
	app = this.getBaseApp();

	/** One arena per DO — shared by all sockets attached to this instance. */
	readonly world = createSessionGameWorld();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			createSockaSession: (_ctx, websocket) =>
				new SockaSessionGameSession(
					websocket,
					this.sessions,
					"json",
					this.world,
				),
		});
	}
}
