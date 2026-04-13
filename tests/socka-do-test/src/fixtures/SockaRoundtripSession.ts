import type { SockaWireFormat } from "socka/core";
import { SockaError } from "socka/core";
import { SockaDoSession } from "socka/do";
import { roundtripContract } from "./roundtrip-contract";

export class SockaRoundtripSession extends SockaDoSession<
	typeof roundtripContract,
	Record<string, never>,
	Env
> {
	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, SockaRoundtripSession>,
		wireFormat: SockaWireFormat,
	) {
		super(websocket, sessions, {
			contract: roundtripContract,
			wireFormat,
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true }),
				fail: async () => {
					throw new SockaError("intentional failure");
				},
			},
			handleClose: async () => {},
		});
	}
}
