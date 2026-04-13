import type { SockaWireFormat } from "socka/core";
import { SockaDoSession } from "socka/do";
import { sessionGameContract } from "../../../socka-server-test/src/fixtures/session-game-contract";
import {
	createSessionGameHandlers,
	type SessionGameSessionData,
	type SessionGameWorld,
} from "../../../socka-server-test/src/fixtures/session-game-state";

export class SockaSessionGameSession extends SockaDoSession<
	typeof sessionGameContract,
	SessionGameSessionData,
	Env
> {
	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, SockaSessionGameSession>,
		wireFormat: SockaWireFormat,
		world: SessionGameWorld,
	) {
		const { handlers, createData } =
			createSessionGameHandlers<
				SockaDoSession<typeof sessionGameContract, SessionGameSessionData, Env>
			>(world);
		super(websocket, sessions, {
			contract: sessionGameContract,
			wireFormat,
			handlers,
			handleClose: async () => {},
			createData: (_ctx) => createData(),
		});
	}
}
