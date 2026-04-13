import { StandardSchemaWebSocketClient } from "@firtoz/websocket-do/schema-client";
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
 * Connects a {@link SyncClientBridge} to a WebSocket using the same codec as `StandardSchemaSession` (`@firtoz/websocket-do`) on the server.
 */
export function connectSync<TItem extends PartialSyncRowShape>(
	bridge: SyncClientBridge<TItem>,
	options: ConnectSyncOptions<TItem>,
): () => void {
	const clientSchema = createClientMessageSchema();
	const serverSchema = createServerMessageSchema<TItem>();
	const useMsgpack = options.transport === "msgpack";

	const schemaClient = new StandardSchemaWebSocketClient({
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
		void schemaClient.send(message);
	});

	bridge.setConnected(false);

	const onOpen = () => {
		bridge.setConnected(true);
	};
	const onClose = () => {
		bridge.setConnected(false);
	};

	schemaClient.socket.addEventListener("open", onOpen);
	schemaClient.socket.addEventListener("close", onClose);

	if (schemaClient.socket.readyState === WebSocket.OPEN) {
		onOpen();
	}

	return () => {
		schemaClient.socket.removeEventListener("open", onOpen);
		schemaClient.socket.removeEventListener("close", onClose);
		bridge.setConnected(false);
		options.setTransportSend(() => {});
		schemaClient.close();
	};
}
