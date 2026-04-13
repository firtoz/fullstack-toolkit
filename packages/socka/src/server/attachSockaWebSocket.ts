import type { SockaContract, SockaContractConfig } from "../core/contract";
import {
	SockaWebSocketSession,
	type SockaWebSocketInit,
	type SockaWebSocketSessionConfig,
} from "./SockaWebSocketSession";

export type AttachedSockaWebSocket<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
> = {
	session: SockaWebSocketSession<TContract, TData>;
	/** Remove listeners and delete this session from the map (idempotent). */
	dispose: () => void;
};

/**
 * Register WebSocket `message` / `close` handlers, insert the session into
 * `sessions`, and return `{ session, dispose }`. `dispose` runs `handleClose`
 * once, then removes listeners (also triggered by `close`).
 */
export function attachSockaWebSocket<
	TContract extends SockaContract<SockaContractConfig>,
	TData,
>(
	websocket: WebSocket,
	sessions: Map<WebSocket, SockaWebSocketSession<TContract, TData>>,
	config: SockaWebSocketSessionConfig<TContract, TData>,
	init?: SockaWebSocketInit,
): AttachedSockaWebSocket<TContract, TData> {
	const session = new SockaWebSocketSession(websocket, sessions, config, init);
	sessions.set(websocket, session);

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
				await config.handleClose();
			} catch (err) {
				console.error("socka: handleClose error:", err);
			} finally {
				finalize();
			}
		})().catch((err: unknown) => {
			console.error("socka: shutdown error:", err);
			finalize();
		});
	};

	const onMessage = (ev: MessageEvent): void => {
		const run = async (): Promise<void> => {
			const wf = config.wireFormat ?? "json";
			const data = ev.data;
			if (typeof data === "string") {
				await session.handleRawMessage(data);
				return;
			}
			if (data instanceof ArrayBuffer) {
				if (wf === "json") {
					await session.handleRawMessage(new TextDecoder().decode(data));
					return;
				}
				await session.handleBinaryMessage(data);
				return;
			}
			if (data instanceof Blob) {
				if (wf === "json") {
					await session.handleRawMessage(await data.text());
				} else {
					await session.handleBinaryMessage(await data.arrayBuffer());
				}
				return;
			}
			if (ArrayBuffer.isView(data)) {
				const v = data;
				const view = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
				if (wf === "json") {
					await session.handleRawMessage(new TextDecoder().decode(view));
					return;
				}
				const copy = new Uint8Array(view.length);
				copy.set(view);
				await session.handleBinaryMessage(copy.buffer);
			}
		};
		void run().catch((err: unknown) => {
			console.error("socka: message handler error:", err);
		});
	};

	const onClose = (): void => {
		shutdown();
	};

	websocket.addEventListener("message", onMessage);
	websocket.addEventListener("close", onClose);

	return { session, dispose: shutdown };
}
