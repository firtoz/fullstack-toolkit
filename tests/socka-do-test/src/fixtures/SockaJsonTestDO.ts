import { SockaWebSocketDO } from "socka/do";
import { SockaRoundtripSession } from "./SockaRoundtripSession";

export class SockaJsonTestDO extends SockaWebSocketDO<
	SockaRoundtripSession,
	Env
> {
	app = this.getBaseApp();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			createSockaSession: (_ctx, websocket) =>
				new SockaRoundtripSession(
					websocket,
					this.sessions as Map<WebSocket, SockaRoundtripSession>,
					"json",
				),
		});
	}
}
