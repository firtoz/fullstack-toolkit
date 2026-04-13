import type { ServerWebSocket } from "bun";
import type { SockaContract, SockaContractConfig } from "../core/contract";
import type { SockaWireFormat } from "../core/wire-codec";
import { dispatchSockaInboundMessage } from "../server/dispatchSockaInboundMessage";
import {
	SockaWebSocketSession,
	runSockaSessionOnAttached,
	type SockaWebSocketSessionConfig,
} from "../server/SockaWebSocketSession";

export type SockaBunWebSocketHandlers<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
> = {
	sessionMap: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
	/** Pass into `Bun.serve({ ..., websocket })`. */
	websocket: {
		open: (ws: ServerWebSocket) => void;
		message: (ws: ServerWebSocket, message: unknown) => void | Promise<void>;
		close: (ws: ServerWebSocket) => void | Promise<void>;
	};
	wireFormat: SockaWireFormat;
};

/**
 * WebSocket handlers for `Bun.serve` when using `ServerWebSocket` (no
 * `addEventListener`). Inbound frames are dispatched with the same logic as
 * `attachSockaWebSocket`.
 */
export function createSockaBunWebSocketHandlers<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
>(
	config: SockaWebSocketSessionConfig<TContract, TData>,
	options?: {
		sessionMap?: Map<WebSocket, SockaWebSocketSession<TContract, TData>>;
	},
): SockaBunWebSocketHandlers<TContract, TData> {
	const sessionMap =
		options?.sessionMap ??
		new Map<WebSocket, SockaWebSocketSession<TContract, TData>>();
	const wireFormat = config.wireFormat ?? "json";

	const websocket: SockaBunWebSocketHandlers<TContract, TData>["websocket"] = {
		open(ws: ServerWebSocket) {
			const domWs = ws as unknown as WebSocket;
			const session = new SockaWebSocketSession(domWs, sessionMap, config);
			sessionMap.set(domWs, session);
			runSockaSessionOnAttached(config, session);
		},
		async message(ws: ServerWebSocket, message: unknown) {
			const domWs = ws as unknown as WebSocket;
			const session = sessionMap.get(domWs);
			if (!session) return;
			await dispatchSockaInboundMessage(
				session,
				wireFormat,
				message as MessageEvent["data"],
			);
		},
		async close(ws: ServerWebSocket) {
			const domWs = ws as unknown as WebSocket;
			try {
				await config.handleClose();
			} catch (err) {
				console.error("socka: handleClose error:", err);
			} finally {
				sessionMap.delete(domWs);
			}
		},
	};

	return { sessionMap, websocket, wireFormat };
}
