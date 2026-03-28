import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { SyncMessage } from "@firtoz/db-helpers";
import { ZodWebSocketClient } from "@firtoz/websocket-do/zod-client";
import type { PartialSyncClientBridge } from "./partial-sync-client-bridge";
import type { SyncClientBridge } from "./sync-client-bridge";
import type { PartialSyncRowId } from "./partial-sync-row-key";
import {
	createClientMessageSchema,
	createServerMessageSchema,
	DEFAULT_SYNC_COLLECTION_ID,
	type SyncClientMessage,
	type SyncServerMessage,
} from "./sync-protocol";

export type ConnectPartialSyncTransport = "json" | "msgpack";

export type PartialSyncMutationItem = {
	id: PartialSyncRowId;
	updatedAt?: number | Date | null;
};

export type ConnectPartialSyncOptions<
	TItem extends { id: PartialSyncRowId } = { id: PartialSyncRowId },
> = {
	url: string;
	transport?: ConnectPartialSyncTransport;
	/** Prefer a module-level function or `useCallback`; a new inline function each render can churn effects. */
	serializeJson?: (value: unknown) => string;
	/** Prefer a module-level function or `useCallback`; a new inline function each render can churn effects. */
	deserializeJson?: (raw: string) => unknown;
	setTransportSend: (send: (msg: SyncClientMessage) => void) => void;
	onServerMessage?: (msg: SyncServerMessage<TItem>) => void;
	/**
	 * When set, inbound messages are split: range traffic → `bridge`, ack/reject/syncBackfill → mutation bridge;
	 * `syncBatch` applies via mutation bridge then updates partial cache ids (no double `receiveSync`).
	 */
	mutationBridge?: SyncClientBridge<TItem & PartialSyncMutationItem>;
};

/** @internal Exported for unit tests; prefer {@link connectPartialSync} in apps. */
export async function dispatchPartialSyncServerMessage<
	TItem extends { id: PartialSyncRowId },
>(
	msg: SyncServerMessage<TItem>,
	partialBridge: PartialSyncClientBridge<TItem>,
	mutationBridge: SyncClientBridge<TItem & PartialSyncMutationItem> | undefined,
): Promise<void> {
	const mid = msg.collectionId ?? DEFAULT_SYNC_COLLECTION_ID;
	const forPartial = mid === partialBridge.collectionId;
	const forMutation =
		mutationBridge !== undefined && mid === mutationBridge.collectionId;

	if (mutationBridge === undefined) {
		if (!forPartial) return;
		await partialBridge.handleServerMessage(msg);
		return;
	}

	switch (msg.type) {
		case "queryRangeChunk":
		case "rangeUpToDate":
		case "rangeDelta":
		case "rangePatch":
		case "pong":
			if (!forPartial) return;
			await partialBridge.handleServerMessage(msg);
			return;
		case "ack":
		case "reject":
		case "syncBackfill":
			if (!forMutation) return;
			await mutationBridge.handleServerMessage(
				msg as SyncServerMessage<TItem & PartialSyncMutationItem>,
			);
			return;
		case "syncBatch": {
			if (!forMutation) return;
			await mutationBridge.handleServerMessage(
				msg as SyncServerMessage<TItem & PartialSyncMutationItem>,
			);
			if (forPartial) {
				partialBridge.syncTrackedIdsFromMessages(
					msg.changes as SyncMessage<TItem>[],
				);
			}
			return;
		}
		default:
			exhaustiveGuard(msg);
	}
}

export function connectPartialSync<
	TItem extends { id: PartialSyncRowId } = { id: PartialSyncRowId },
>(
	bridge: PartialSyncClientBridge<TItem>,
	options: ConnectPartialSyncOptions<TItem>,
): () => void {
	const clientSchema = createClientMessageSchema();
	const serverSchema = createServerMessageSchema<TItem>();
	const useMsgpack = options.transport === "msgpack";
	const mutationBridge = options.mutationBridge;
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
			void dispatchPartialSyncServerMessage(msg, bridge, mutationBridge);
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
		mutationBridge?.setConnected(true);
	};
	const onClose = () => {
		pendingOutbound.length = 0;
		bridge.setConnected(false);
		mutationBridge?.setConnected(false);
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
		mutationBridge?.setConnected(false);
		options.setTransportSend(() => {});
		zodClient.close();
	};
}
