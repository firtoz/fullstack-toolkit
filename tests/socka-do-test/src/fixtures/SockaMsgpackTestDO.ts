import { SockaWebSocketDO } from "@firtoz/socka/do";
import { SockaRoundtripSession } from "./SockaRoundtripSession";

export class SockaMsgpackTestDO extends SockaWebSocketDO<
	SockaRoundtripSession,
	Env
> {
	app = this.getBaseApp();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			createSockaSession: (_ctx, websocket) =>
				new SockaRoundtripSession(websocket, this.sessions, "msgpack"),
		});
	}
}
