import type { Collection, UtilsRecord } from "@tanstack/db";
import type { CacheManager } from "../cache-manager";
import type {
	PartialSyncClientBridge,
	PartialSyncState,
} from "../partial-sync-client-bridge";
import type { PartialSyncViewportAdapter } from "./partial-sync-adapter";
import type { ConnectPartialSyncTransport } from "../connect-partial-sync";
import type { SyncClientBridge } from "../sync-client-bridge";
import type { PartialSyncRowShape } from "../partial-sync-row-key";
import type { RangeCondition, SyncClientMessage } from "../sync-protocol";

export type {
	PartialSyncRowRef,
	PartialSyncRowShape,
	PartialSyncRowVersion,
} from "../partial-sync-row-key";

/** Row shape for partial-sync React hooks (mandatory `updatedAt` for fingerprints / reconciliation). */
export type PartialSyncItem = PartialSyncRowShape;

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
	/**
	 * Must match the server's partial-sync {@link PartialSyncServerBridgeOptions.collectionId} and align with
	 * {@link SyncClientBridgeOptions.collectionId} on {@link mutationBridge}.
	 */
	collectionId?: string;
	/**
	 * `confirmed` filters dense `rows` to {@link PartialSyncClientBridge.serverConfirmedKeys} only
	 * (same semantics as {@link UsePartialSyncViewportOptions.cacheDisplayMode}).
	 */
	cacheDisplayMode?: CacheDisplayMode;
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

/** Collection usable with {@link useLiveQuery} and partial-sync helpers. */
export type PartialSyncLiveCollection<TItem extends PartialSyncItem> =
	PartialSyncCollection<TItem> &
		Collection<TItem, string | number, UtilsRecord>;

export type CacheDisplayMode = "immediate" | "confirmed";

export type UsePredicateFilteredRowsOptions<
	TItem extends PartialSyncItem,
	TSortColumn extends keyof TItem & string = keyof TItem & string,
> = {
	collection: PartialSyncLiveCollection<TItem>;
	conditions: RangeCondition[];
	sort: { column: TSortColumn; direction: "asc" | "desc" };
	getSortValue: (row: TItem, column: TSortColumn) => unknown;
	/**
	 * For predicate `column` strings when using a custom row shape; the live-query path reads
	 * properties named in {@link RangeCondition.column} on each row (same as default column read).
	 */
	getColumnValue?: (row: TItem, column: string) => unknown;
	limit?: number;
	/**
	 * `immediate`: show all rows matching the predicate (including cache-only).
	 * `confirmed`: only rows whose keys appear in {@link confirmedRowKeys} (from the bridge).
	 */
	cacheDisplayMode?: CacheDisplayMode;
	/** Required when `cacheDisplayMode` is `"confirmed"`; typically `bridge.serverConfirmedKeys`. */
	confirmedRowKeys?: ReadonlySet<string | number>;
	/** Pass `bridge.serverConfirmedKeysRevision` so React re-runs the query when the set mutates. */
	confirmedKeysRevision?: number;
};

export type UsePartialSyncCollectionOptions<TItem extends PartialSyncItem> = {
	collection: PartialSyncCollection<TItem>;
	mutationBridge: SyncClientBridge<TItem>;
	wsUrl: string;
	wsTransport?: ConnectPartialSyncTransport;
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;
	mergeTransportSend?: (send: (msg: SyncClientMessage) => void) => void;
	collectionId?: string;
	beforeApplyRows?: (rows: TItem[]) => Promise<void>;
};

export type UsePartialSyncCollectionResult<TItem extends PartialSyncItem> = {
	bridge: PartialSyncClientBridge<TItem>;
	bridgeState: PartialSyncState;
};

export type UsePartialSyncViewportOptions<
	TItem extends PartialSyncItem,
	TViewport,
	TSortColumn extends keyof TItem & string,
> = {
	bridge: PartialSyncClientBridge<TItem>;
	/** From {@link usePartialSyncCollection}; drives {@link UsePartialSyncViewportResult.totalCount}. */
	bridgeState: PartialSyncState;
	collection: PartialSyncLiveCollection<TItem>;
	adapter: PartialSyncViewportAdapter<TItem, TViewport, TSortColumn>;
	viewport: TViewport;
	predicateLimit: number;
	prefetchPad?: number;
	quietMs?: number;
	maxWaitMs?: number;
	/**
	 * Used when the bridge has not yet reported `totalCount` (e.g. world size for sparse grids).
	 */
	totalCountFallback?: number;
	getColumnValue?: (row: TItem, column: string) => unknown;
	cacheDisplayMode?: CacheDisplayMode;
};

export type UsePartialSyncViewportResult<TItem extends PartialSyncItem> = {
	viewportRows: TItem[];
	totalCount: number;
};
