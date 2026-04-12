import { ZodSession, type ZodSessionOptions } from "@firtoz/websocket-do";
import {
	handleVpWsClientMsg,
	type VpWsClientMsg,
	type VpWsHandlerDeps,
	type VpWsServerMsg,
	vpWsClientMessageSchema,
	vpWsServerMessageSchema,
} from "./vp-ws-protocol";

export type VpWsSessionData = Record<string, never>;

export function vpWsZodSessionOptions(): ZodSessionOptions<
	VpWsClientMsg,
	VpWsServerMsg
> {
	return {
		clientSchema: vpWsClientMessageSchema,
		serverSchema: vpWsServerMessageSchema,
		enableBufferMessages: false,
	};
}

export class VirtualPropsWsZodSession extends ZodSession<
	VpWsSessionData,
	VpWsServerMsg,
	VpWsClientMsg,
	Env
> {
	constructor(
		websocket: WebSocket,
		sessions: Map<WebSocket, VirtualPropsWsZodSession>,
		options: ZodSessionOptions<VpWsClientMsg, VpWsServerMsg>,
		private readonly deps: VpWsHandlerDeps,
	) {
		super(websocket, sessions, options, {
			createData: () => ({}),
			handleValidatedMessage: async (message: VpWsClientMsg) => {
				try {
					const reply = await handleVpWsClientMsg(message, this.deps);
					this.send(reply);
				} catch (err) {
					const text = err instanceof Error ? err.message : "Insert failed";
					this.send({
						type: "error",
						id: message.id,
						error: text,
					});
				}
			},
			handleValidationError: async (_error, originalMessage) => {
				let id = "";
				if (typeof originalMessage === "string") {
					try {
						const parsed: unknown = JSON.parse(originalMessage);
						if (
							parsed &&
							typeof parsed === "object" &&
							"id" in parsed &&
							typeof (parsed as { id: unknown }).id === "string"
						) {
							id = (parsed as { id: string }).id;
						}
					} catch {
						// ignore JSON errors
					}
				}
				this.send({
					type: "error",
					id,
					error: "Invalid message",
				});
			},
			handleClose: async () => {
				// no per-connection state to tear down
			},
		});
	}
}
