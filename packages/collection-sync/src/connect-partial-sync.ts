import { ZodWebSocketClient } from "@firtoz/websocket-do/zod-client";
import type { PartialSyncClientBridge } from "./partial-sync-client-bridge";
import {
	createClientMessageSchema,
	createServerMessageSchema,
	type SyncClientMessage,
	type SyncServerMessage,
} from "./sync-protocol";

export type ConnectPartialSyncTransport = "json" | "msgpack";

export type ConnectPartialSyncOptions<TItem = unknown> = {
	url: string;
	transport?: ConnectPartialSyncTransport;
	/** Prefer a module-level function or `useCallback`; a new inline function each render can churn effects. */
	serializeJson?: (value: unknown) => string;
	/** Prefer a module-level function or `useCallback`; a new inline function each render can churn effects. */
	deserializeJson?: (raw: string) => unknown;
	setTransportSend: (send: (msg: SyncClientMessage) => void) => void;
	onServerMessage?: (msg: SyncServerMessage<TItem>) => void;
};

export function connectPartialSync<TItem extends { id: string | number }>(
	bridge: PartialSyncClientBridge<TItem>,
	options: ConnectPartialSyncOptions<TItem>,
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

	/** DO not call `WebSocket.send` until `OPEN`; queue outbound messages until then. */
	const pendingOutbound: SyncClientMessage[] = [];

	const flushPendingOutbound = () => {
		while (
			pendingOutbound.length > 0 &&
			zodClient.socket.readyState === WebSocket.OPEN
		) {
			const message = pendingOutbound.shift();
			if (message !== undefined) {
				zodClient.send(message);
			}
		}
	};

	options.setTransportSend((message) => {
		if (zodClient.socket.readyState === WebSocket.OPEN) {
			zodClient.send(message);
		} else {
			pendingOutbound.push(message);
		}
	});

	bridge.setConnecting();

	const onOpen = () => {
		flushPendingOutbound();
		bridge.setConnected(true);
	};
	const onClose = () => {
		pendingOutbound.length = 0;
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
		pendingOutbound.length = 0;
		bridge.setConnected(false);
		options.setTransportSend(() => {});
		zodClient.close();
	};
}
