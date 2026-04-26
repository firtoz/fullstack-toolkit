import type { SockaContractBound } from "../core/contract";
import { reportSockaError } from "../core/socka-report-error";
import { dispatchSockaInboundMessage } from "./dispatchSockaInboundMessage";
import {
	SockaWebSocketSession,
	runSockaSessionOnAttached,
	type SockaWebSocketInit,
	type SockaWebSocketSessionConfigUnion,
} from "./SockaWebSocketSession";

export type AttachedSockaWebSocket<
	TContract extends SockaContractBound,
	TData,
> = {
	session: SockaWebSocketSession<TContract, TData>;
	/** Remove listeners and delete this session from the map (idempotent). */
	dispose: () => void;
};

/**
 * Register WebSocket `message` / `close` handlers, insert the session into
 * `sessions`, and return `{ session, dispose }`. `dispose` runs
 * {@link SockaWebSocketSession.invokeHandleClose} once, then removes listeners
 * (also triggered by `close`).
 */
export function attachSockaWebSocket<
	TContract extends SockaContractBound,
	TData,
>(
	websocket: WebSocket,
	sessions: Map<WebSocket, SockaWebSocketSession<TContract, TData>>,
	config: SockaWebSocketSessionConfigUnion<TContract, TData>,
	init?: SockaWebSocketInit,
): AttachedSockaWebSocket<TContract, TData> {
	const session = new SockaWebSocketSession(websocket, sessions, config, init);
	sessions.set(websocket, session);
	runSockaSessionOnAttached(config, session);

	let shuttingDown = false;

	const finalize = (): void => {
		websocket.removeEventListener("message", onMessage);
		websocket.removeEventListener("close", onClose);
		sessions.delete(websocket);
	};

	const shutdown = (): void => {
		if (shuttingDown) return;
		shuttingDown = true;
		void (async (): Promise<void> => {
			try {
				await session.invokeHandleClose();
			} catch (error) {
				reportSockaError(config.reportError, {
					kind: "serverHandleClose",
					error,
				});
			} finally {
				finalize();
			}
		})().catch((error: unknown) => {
			reportSockaError(config.reportError, {
				kind: "serverShutdown",
				adapter: "attach",
				error,
			});
			finalize();
		});
	};

	const onMessage = (ev: MessageEvent): void => {
		const wf = config.wireFormat ?? "json";
		void dispatchSockaInboundMessage(session, wf, ev.data).catch(
			(error: unknown) => {
				reportSockaError(config.reportError, {
					kind: "serverInboundMessage",
					adapter: "attach",
					error,
				});
			},
		);
	};

	const onClose = (): void => {
		shutdown();
	};

	websocket.addEventListener("message", onMessage);
	websocket.addEventListener("close", onClose);

	return { session, dispose: shutdown };
}
