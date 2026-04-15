import type { SockaWireFormat } from "@firtoz/socka/core";
import { SockaError } from "@firtoz/socka/core";
import { SockaDoSession } from "@firtoz/socka/do";
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
