import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { SyncMessage } from "@firtoz/db-helpers";
import { ZodWebSocketClient } from "@firtoz/websocket-do/zod-client";
import type { PartialSyncClientBridge } from "./partial-sync-client-bridge";
import type { SyncClientBridge } from "./sync-client-bridge";
import {
	partialSyncRowKey,
	type PartialSyncRowShape,
} from "./partial-sync-row-key";
import {
	createClientMessageSchema,
	createServerMessageSchema,
	DEFAULT_SYNC_COLLECTION_ID,
	type SyncClientMessage,
	type SyncServerMessage,
} from "./sync-protocol";

/**
 * Optional browser `document` for Page Visibility — accessed via `globalThis` so this module typechecks
 * under configs that omit the DOM global (e.g. Worker-only `lib`).
 */
type PageVisibilityDocument = {
	readonly visibilityState: string;
	addEventListener(type: "visibilitychange", listener: () => void): void;
	removeEventListener(type: "visibilitychange", listener: () => void): void;
};

function pageVisibilityDocument(): PageVisibilityDocument | undefined {
	return (
		globalThis as typeof globalThis & { document?: PageVisibilityDocument }
	).document;
}

export type ConnectPartialSyncTransport = "json" | "msgpack";

export type ConnectPartialSyncOptions<
	TItem extends PartialSyncRowShape = PartialSyncRowShape,
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
	mutationBridge?: SyncClientBridge<TItem>;
};

/**
 * @internal Exported for unit tests; prefer {@link connectPartialSync} in apps.
 * After a `rangePatch`, call `partialBridge.flushPendingCoalescedInboundUpdates()` unless you use
 * `connectPartialSync` (the pump flushes coalesced updates after each inbound job).
 */
export async function dispatchPartialSyncServerMessage<
	TItem extends PartialSyncRowShape,
>(
	msg: SyncServerMessage<TItem>,
	partialBridge: PartialSyncClientBridge<TItem>,
	mutationBridge: SyncClientBridge<TItem> | undefined,
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
			await mutationBridge.handleServerMessage(msg);
			return;
		case "syncBatch": {
			if (!forMutation) return;
			await mutationBridge.handleServerMessage(msg);
			if (forPartial) {
				const changes = msg.changes as SyncMessage<TItem>[];
				partialBridge.syncTrackedIdsFromMessages(changes);
			}
			return;
		}
		default:
			exhaustiveGuard(msg);
	}
}

export type CoalescedRangePatchMessage<TItem extends PartialSyncRowShape> =
	Extract<SyncServerMessage<TItem>, { type: "rangePatch" }>;

/**
 * Last-wins merge of buffered `rangePatch` messages (same row id keeps the latest patch).
 * @internal Exported for unit tests.
 */
export function mergeCoalescedRangePatches<TItem extends PartialSyncRowShape>(
	patches: CoalescedRangePatchMessage<TItem>[],
): CoalescedRangePatchMessage<TItem>[] {
	let truncateWinner: CoalescedRangePatchMessage<TItem> | undefined;
	const byRow = new Map<string | number, CoalescedRangePatchMessage<TItem>>();
	for (const p of patches) {
		const ch = p.change;
		switch (ch.type) {
			case "truncate":
				truncateWinner = p;
				byRow.clear();
				break;
			case "insert":
			case "update": {
				const k = partialSyncRowKey(ch.value.id);
				byRow.set(k, p);
				break;
			}
			case "delete":
				byRow.set(ch.key, p);
				break;
			default:
				exhaustiveGuard(ch);
		}
	}
	if (truncateWinner !== undefined) return [truncateWinner];
	return [...byRow.values()];
}

export function connectPartialSync<
	TItem extends PartialSyncRowShape = PartialSyncRowShape,
>(
	bridge: PartialSyncClientBridge<TItem>,
	options: ConnectPartialSyncOptions<TItem>,
): () => void {
	const clientSchema = createClientMessageSchema();
	const serverSchema = createServerMessageSchema<TItem>();
	const useMsgpack = options.transport === "msgpack";
	const mutationBridge = options.mutationBridge;
	/**
	 * Serialized inbound handling without chaining `.then` per message (that grows the promise graph
	 * linearly with traffic → accumulating latency, memory pressure, and eventual tab crashes).
	 */
	type InboundJob = () => Promise<void>;
	const inboundWorkQueue: InboundJob[] = [];
	let inboundPumpRunning = false;
	let connectDisposed = false;

	/**
	 * Single pump: drain all queued jobs, then **await** `flushPendingCoalescedInboundUpdates` so
	 * coalesced `rangePatch` rows are applied before the next drain pass (prevents duplicate-insert
	 * from `ack`/`syncBatch`). If new jobs arrived during the flush, loop.
	 *
	 * Only one pump runs at a time (`inboundPumpRunning`). Unlike the earlier version that left
	 * the flag set while awaiting a potentially-stalled flush, the flag is reset in a `finally`
	 * that runs **after** both the drain and the flush, and errors are caught per-job so one
	 * failure cannot block subsequent work.
	 */
	const runInboundPump = async (): Promise<void> => {
		if (inboundPumpRunning) return;
		inboundPumpRunning = true;
		try {
			do {
				while (inboundWorkQueue.length > 0) {
					const job = inboundWorkQueue.shift();
					if (job === undefined) continue;
					try {
						await job();
					} catch (err) {
						console.error("[connectPartialSync] inbound job error", err);
					}
					if (connectDisposed) return;
				}
				try {
					await bridge.flushPendingCoalescedInboundUpdates();
				} catch (err) {
					console.error("[connectPartialSync] coalesced flush error", err);
				}
			} while (!connectDisposed && inboundWorkQueue.length > 0);
		} finally {
			inboundPumpRunning = false;
			if (!connectDisposed && inboundWorkQueue.length > 0) {
				void runInboundPump();
			}
		}
	};

	const enqueueInbound = (job: InboundJob): void => {
		inboundWorkQueue.push(job);
		void runInboundPump();
	};

	let rangePatchCoalesceBuffer: CoalescedRangePatchMessage<TItem>[] = [];
	/**
	 * `requestAnimationFrame` can run between WebSocket deliveries, flushing a single `rangePatch`
	 * while more patches are still queued on the inbound chain — causing duplicate `receiveSync`
	 * and stepped replay. A deduped microtask flush runs after the current sync work so bursts
	 * in the same turn coalesce before paint.
	 */
	let rangePatchFlushMicrotaskQueued = false;

	const drainRangePatchCoalesceBuffer = async (): Promise<void> => {
		if (rangePatchCoalesceBuffer.length === 0) return;
		const merged = mergeCoalescedRangePatches(rangePatchCoalesceBuffer);
		rangePatchCoalesceBuffer = [];
		for (const m of merged) {
			await dispatchPartialSyncServerMessage(m, bridge, mutationBridge);
		}
	};

	const scheduleCoalescedRangePatchFlushMicrotask = (): void => {
		if (rangePatchFlushMicrotaskQueued) return;
		rangePatchFlushMicrotaskQueued = true;
		queueMicrotask(() => {
			rangePatchFlushMicrotaskQueued = false;
			enqueueInbound(async () => {
				await drainRangePatchCoalesceBuffer();
			});
		});
	};

	const cancelCoalescedRangePatchDeferredFlush = (): void => {
		rangePatchFlushMicrotaskQueued = false;
	};

	const flushCoalescedRangePatchesInline = async (): Promise<void> => {
		cancelCoalescedRangePatchDeferredFlush();
		await drainRangePatchCoalesceBuffer();
	};

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
			enqueueInbound(async () => {
				options.onServerMessage?.(msg);
				if (mutationBridge === undefined) {
					await dispatchPartialSyncServerMessage(msg, bridge, mutationBridge);
					return;
				}
				const mid = msg.collectionId ?? DEFAULT_SYNC_COLLECTION_ID;
				const forPartial = mid === bridge.collectionId;
				if (msg.type === "rangePatch" && forPartial) {
					rangePatchCoalesceBuffer.push(msg);
					scheduleCoalescedRangePatchFlushMicrotask();
					return;
				}
				await flushCoalescedRangePatchesInline();
				await dispatchPartialSyncServerMessage(msg, bridge, mutationBridge);
			});
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

	const onVisibilityFlush = (): void => {
		const doc = pageVisibilityDocument();
		if (doc === undefined) return;
		if (doc.visibilityState !== "visible") return;
		enqueueInbound(async () => {
			await flushCoalescedRangePatchesInline();
		});
	};

	const visibilityDoc = pageVisibilityDocument();
	if (visibilityDoc !== undefined) {
		visibilityDoc.addEventListener("visibilitychange", onVisibilityFlush);
	}

	return () => {
		connectDisposed = true;
		const docCleanup = pageVisibilityDocument();
		if (docCleanup !== undefined) {
			docCleanup.removeEventListener("visibilitychange", onVisibilityFlush);
		}
		cancelCoalescedRangePatchDeferredFlush();
		inboundWorkQueue.length = 0;
		rangePatchCoalesceBuffer = [];
		zodClient.socket.removeEventListener("open", onOpen);
		zodClient.socket.removeEventListener("close", onClose);
		pendingOutbound.length = 0;
		bridge.setConnected(false);
		mutationBridge?.setConnected(false);
		options.setTransportSend(() => {});
		zodClient.close();
	};
}
