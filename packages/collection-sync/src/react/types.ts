import type { UtilsRecord } from "@tanstack/db";
import type { CacheManager } from "../cache-manager";
import type {
	PartialSyncClientBridge,
	PartialSyncState,
} from "../partial-sync-client-bridge";
import type { ConnectPartialSyncTransport } from "../connect-partial-sync";
import type { RangeCondition } from "../sync-protocol";

/** Row shape expected for version-watermark fingerprints (default: `updatedAt` → ms). */
export type PartialSyncItem = {
	id: string | number;
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

export type UsePartialSyncWindowOptions<
	TItem extends PartialSyncItem,
	TSortColumn extends keyof TItem & string = keyof TItem & string,
> = {
	collection: PartialSyncCollection<TItem>;
	sort: { column: TSortColumn; direction: "asc" | "desc" };
	getSortValue: (row: TItem, column: TSortColumn) => unknown;

	wsUrl: string;
	wsTransport?: ConnectPartialSyncTransport;
	serializeJson?: (value: unknown) => string;
	deserializeJson?: (raw: string) => unknown;

	getVersionMs?: (row: TItem) => number;
	getSortPositions?: (row: TItem) => Record<string, unknown>;

	pageLimit?: number;
	seekRowGap?: number;
	seekCooldownMs?: number;
};

export type UsePartialSyncWindowResult<TItem extends PartialSyncItem> = {
	rows: TItem[];
	windowStartIndex: number;
	totalCount: number;
	loading: boolean;
	hasMore: boolean;
	bridgeState: PartialSyncState;
	bridge: PartialSyncClientBridge<TItem>;
	cacheManager: CacheManager<TItem>;
	fetchNext: () => Promise<void>;
	seekToViewport: (
		firstVisibleIndex: number,
		opts?: { scrollSettled?: boolean },
	) => void;
	seekAfterScrollSettled: (firstVisibleIndex: number) => void;
	viewportInfo: ViewportInfo;
	setViewportInfo: (info: ViewportInfo) => void;
	lastSeekMeta: {
		offset: number;
		reason: "scroll" | "scrollSettled";
	} | null;
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
