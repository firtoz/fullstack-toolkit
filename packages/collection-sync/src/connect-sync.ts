import { ZodWebSocketClient } from "@firtoz/websocket-do/zod-client";
import type { SyncClientBridge } from "./sync-client-bridge";
import type { PartialSyncRowShape } from "./partial-sync-row-key";
import {
	createClientMessageSchema,
	createServerMessageSchema,
	type SyncClientMessage,
	type SyncServerMessage,
} from "./sync-protocol";

export type ConnectSyncTransport = "json" | "msgpack";

export type ConnectSyncOptions<TItem = unknown> = {
	/** WebSocket URL (e.g. `wss://host/room/x/websocket`). */
	url: string;
	transport?: ConnectSyncTransport;
	/** Prefer a module-level function or `useCallback`; a new inline function each render can churn effects. */
	serializeJson?: (value: unknown) => string;
	/** Prefer a module-level function or `useCallback`; a new inline function each render can churn effects. */
	deserializeJson?: (raw: string) => unknown;
	/** Wire transport after {@link SyncClientBridge} is created (from {@link withSync}). */
	setTransportSend: (send: (msg: SyncClientMessage) => void) => void;
	/** Optional tap before messages reach the bridge (e.g. debug / inspector). */
	onServerMessage?: (msg: SyncServerMessage<TItem>) => void;
};

/**
 * Connects a {@link SyncClientBridge} to a WebSocket using the same codec as {@link ZodSession} on the server.
 */
export function connectSync<TItem extends PartialSyncRowShape>(
	bridge: SyncClientBridge<TItem>,
	options: ConnectSyncOptions<TItem>,
): () => void {
	const clientSchema = createClientMessageSchema();
	const serverSchema = createServerMessageSchema<TItem>();
	const useMsgpack = options.transport === "msgpack";

	const zodClient = new ZodWebSocketClient({
		url: options.url,
		clientSchema,
		serverSchema,
		enableBufferMessages: useMsgpack,
		...(useMsgpack
			? {}
			: {
					serializeJson: options.serializeJson ?? JSON.stringify,
					deserializeJson: options.deserializeJson ?? JSON.parse,
				}),
		onMessage: (msg) => {
			options.onServerMessage?.(msg);
			void bridge.handleServerMessage(msg);
		},
	});

	options.setTransportSend((message) => {
		zodClient.send(message);
	});

	bridge.setConnected(false);

	const onOpen = () => {
		bridge.setConnected(true);
	};
	const onClose = () => {
		bridge.setConnected(false);
	};

	zodClient.socket.addEventListener("open", onOpen);
	zodClient.socket.addEventListener("close", onClose);

	if (zodClient.socket.readyState === WebSocket.OPEN) {
		onOpen();
	}

	return () => {
		zodClient.socket.removeEventListener("open", onOpen);
		zodClient.socket.removeEventListener("close", onClose);
		bridge.setConnected(false);
		options.setTransportSend(() => {});
		zodClient.close();
	};
}
