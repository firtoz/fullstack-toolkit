import type { UtilsRecord } from "@tanstack/db";
import type { CacheManager } from "../cache-manager";
import type {
	PartialSyncClientBridge,
	PartialSyncState,
} from "../partial-sync-client-bridge";
import type { ConnectPartialSyncTransport } from "../connect-partial-sync";
import type { SyncClientBridge } from "../sync-client-bridge";
import type { PartialSyncRowId } from "../partial-sync-row-key";
import type { RangeCondition, SyncClientMessage } from "../sync-protocol";

/** Row shape expected for version-watermark fingerprints (default: `updatedAt` → ms). */
export type PartialSyncItem = {
	id: PartialSyncRowId;
	updatedAt?: number | Date | null;
};

/**
 * Minimal collection surface for partial-sync window hooks (TanStack `Collection` satisfies this
 * when `get` / `entries` are typed consistently).
 */
export type PartialSyncCollection<TItem extends PartialSyncItem> = {
	get(key: string | number): TItem | undefined;
	subscribeChanges(
		callback: (changes: unknown[]) => void,
		options?: { includeInitialState?: boolean },
	): { unsubscribe: () => void };
	entries(): IterableIterator<[string | number, TItem]>;
	/** TanStack collections use `UtilsRecord`; runtime must include `receiveSync` / `truncate`. */
	utils: UtilsRecord;
};

export type ViewportInfo = {
	firstVisibleIndex: number;
	lastVisibleIndex: number;
};

/** Per global row index: where the cell’s data comes from (for UI / debugging). */
export type PartialSyncRowSlot =
	| "ready"
	| "ready_global"
	| "stale_map"
	| "server"
	| "none";

export type PartialSyncRowSlotView<TItem extends PartialSyncItem> = {
	row: TItem | undefined;
	slot: PartialSyncRowSlot;
};

export type UsePartialSyncWindowOptions<
	TItem extends PartialSyncItem,
	TSortColumn extends keyof TItem & string = keyof TItem & string,
> = {
	collection: PartialSyncCollection<TItem>;
	sort: { column: TSortColumn; direction: "asc" | "desc" };
	getSortValue: (row: TItem, column: TSortColumn) => unknown;

	wsUrl: string;
	wsTransport?: ConnectPartialSyncTransport;
	/** Use a module-level function or `useCallback`; inline arrows are a new reference every render. */
	serializeJson?: (value: unknown) => string;
	/** Use a module-level function or `useCallback`; inline arrows are a new reference every render. */
	deserializeJson?: (raw: string) => unknown;

	getVersionMs?: (row: TItem) => number;
	getSortPositions?: (row: TItem) => Record<string, unknown>;

	pageLimit?: number;
	seekCooldownMs?: number;
	/**
	 * Stable id for the **logical** collection instance (e.g. `${backend}-${roomId}`). The partial
	 * window resets (truncate + index map) when this or {@link sort} changes — **not** when the
	 * TanStack `collection` reference churns. Omit only if the collection instance is stable for the
	 * hook lifetime; otherwise local edits can spuriously reset the window.
	 */
	partialWindowResetKey?: string;
	/**
	 * When set, `mutateBatch` / ack / `syncBatch` route through this bridge; `clientId` matches
	 * {@link PartialSyncClientBridge}. Use with {@link createPartialSyncedCollection} / {@link withSync}.
	 */
	mutationBridge?: SyncClientBridge<TItem>;
	/**
	 * Called once when the WebSocket transport `send` is ready (same function {@link withSync} / mutation bridge use).
	 */
	mergeTransportSend?: (send: (msg: SyncClientMessage) => void) => void;
};

export type UsePartialSyncWindowResult<TItem extends PartialSyncItem> = {
	rows: TItem[];
	windowStartIndex: number;
	totalCount: number;
	/**
	 * True while a server `requestRangeQuery` is in flight (cursor append or offset seek).
	 * False for cache-only window moves (`tryIds` / fingerprint `upToDate` without a round-trip).
	 */
	rangeRequestInFlight: boolean;
	hasMore: boolean;
	bridgeState: PartialSyncState;
	bridge: PartialSyncClientBridge<TItem>;
	cacheManager: CacheManager<TItem>;
	fetchNext: () => Promise<void>;
	seekToViewport: (
		firstVisibleIndex: number,
		opts?: {
			scrollSettled?: boolean;
			lastVisibleIndex?: number;
			/** Skip density/cooldown short-circuits (e.g. index map out of sync with collection). */
			force?: boolean;
		},
	) => void;
	seekAfterScrollSettled: (
		firstVisibleIndex: number,
		lastVisibleIndex?: number,
	) => void;
	viewportInfo: ViewportInfo;
	setViewportInfo: (info: ViewportInfo) => void;
	lastSeekMeta: {
		offset: number;
		reason: "scroll" | "scrollSettled";
	} | null;
	/**
	 * Resolve one global index via index map + collection, and classify the cell.
	 * Use this for row UI so cached rows still render when the dense `rows` window has not caught up.
	 */
	getRowSlot: (globalIndex: number) => PartialSyncRowSlotView<TItem>;
};

export type UsePredicateFilteredRowsOptions<
	TItem extends PartialSyncItem,
	TSortColumn extends keyof TItem & string = keyof TItem & string,
> = {
	collection: PartialSyncCollection<TItem>;
	conditions: RangeCondition[];
	sort: { column: TSortColumn; direction: "asc" | "desc" };
	getSortValue: (row: TItem, column: TSortColumn) => unknown;
	/** For predicate `column` strings; defaults to property read when present on the row object. */
	getColumnValue?: (row: TItem, column: string) => unknown;
	limit?: number;
};
