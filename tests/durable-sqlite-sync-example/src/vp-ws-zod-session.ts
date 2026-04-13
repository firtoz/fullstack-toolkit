import { SockaDoSession, type SockaDoSessionConfig } from "socka/do";
import { SockaError } from "socka/core";
import { vpContract, type VpWsHandlerDeps } from "./vp-ws-protocol";
import { VP_SLOW_INSERT_DELAY_MS } from "./vp-demo-constants";

export type VpWsSessionData = Record<string, never>;

type VpSessionConfig = SockaDoSessionConfig<
	typeof vpContract,
	VpWsSessionData,
	Env
>;

export class VirtualPropsWsSockaSession extends SockaDoSession<
	typeof vpContract,
	VpWsSessionData,
	Env
> {
	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, VirtualPropsWsSockaSession>,
		deps: VpWsHandlerDeps,
	) {
		const config: VpSessionConfig = {
			contract: vpContract,
			handlers: {
				list: async () => {
					return deps.listMessages();
				},
				insert: async (input) => {
					const delayMs = input.slow === true ? VP_SLOW_INSERT_DELAY_MS : 0;
					if (delayMs > 0) {
						await new Promise((r) => setTimeout(r, delayMs));
					}
					try {
						await deps.insertMessage(input.message);
					} catch (err) {
						throw err instanceof SockaError
							? err
							: new SockaError(
									err instanceof Error ? err.message : String(err),
								);
					}
				},
			},
			handleClose: async () => {},
			onHandlerError: (err, rpcName) => {
				console.error(`Handler error in ${rpcName}:`, err);
			},
		};
		super(
			websocket,
			sessions as Map<
				WebSocket,
				SockaDoSession<typeof vpContract, VpWsSessionData, Env>
			>,
			config,
		);
	}
}
