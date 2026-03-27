import {
	CacheManager,
	connectPartialSync,
	PartialSyncClientBridge,
	type PartialSyncState,
	type SyncClientMessage,
} from "@firtoz/collection-sync";
import type { SyncMessage } from "@firtoz/db-helpers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import superjson from "superjson";
import { PeopleVirtualList, type ViewportInfo } from "./PeopleVirtualList";
import { SyncStatusBar } from "./SyncStatusBar";
import type { PersonRow, SortState, WsTransport } from "./types";

const PAGE_LIMIT = 50;
/** Same slack as `PeopleVirtualList` SEEK_ROW_GAP — viewport past loaded window ⇒ catch-up seek. */
const SEEK_ROW_GAP = 80;
const SEEK_COOLDOWN_MS = 200;
const DEFAULT_SORT: SortState = {
	column: "name",
	direction: "asc",
};

function cursorFromRow(row: PersonRow, sort: SortState): unknown {
	return sort.column === "age" ? row.age : row.name;
}

/** Global row index (current sort) → row, for instant re-hydration of a previously fetched window. */
function recordRowsAtGlobalIndices(
	cache: Map<number, PersonRow>,
	startGlobal: number,
	rows: PersonRow[],
): void {
	for (let i = 0; i < rows.length; i += 1) {
		cache.set(startGlobal + i, rows[i]);
	}
}

/**
 * Returns null if any index in the wanted range is missing, or if totalCount is unknown (0).
 * Returns [] when want is 0 but totalCount > 0 (slice past end).
 */
function trySliceFromGlobalIndexCache(
	cache: Map<number, PersonRow>,
	offset: number,
	limit: number,
	totalCount: number,
): PersonRow[] | null {
	if (totalCount === 0) return null;
	const want = Math.min(limit, Math.max(0, totalCount - offset));
	if (want === 0) return [];
	const out: PersonRow[] = [];
	for (let i = 0; i < want; i += 1) {
		const r = cache.get(offset + i);
		if (r === undefined) return null;
		out.push(r);
	}
	return out;
}

type Props = {
	collection: {
		utils: {
			receiveSync: (messages: SyncMessage<PersonRow>[]) => Promise<void>;
			truncate: () => Promise<void>;
		};
	};
	roomId: string;
	wsTransport: WsTransport;
	label: string;
};

export function PeoplePartialSyncClient({
	collection,
	roomId,
	wsTransport,
	label,
}: Props) {
	const [rows, setRows] = useState<PersonRow[]>([]);
	/** Global index of `rows[0]` in the current sort order (0 when loading from the top). */
	const [windowStartIndex, setWindowStartIndex] = useState(0);
	const [totalCount, setTotalCount] = useState(0);
	const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
	const [nextCursor, setNextCursor] = useState<unknown | null>(null);
	const [hasMore, setHasMore] = useState(true);
	const [loading, setLoading] = useState(false);
	const [bridgeState, setBridgeState] = useState<PartialSyncState>({
		status: "offline",
	});
	const [viewportInfo, setViewportInfo] = useState<ViewportInfo>({
		firstVisibleIndex: 0,
		lastVisibleIndex: 0,
	});
	const [lastSeekMeta, setLastSeekMeta] = useState<{
		offset: number;
		reason: "scroll" | "scrollSettled";
	} | null>(null);

	const rowsRef = useRef(rows);
	rowsRef.current = rows;
	const windowStartRef = useRef(windowStartIndex);
	windowStartRef.current = windowStartIndex;
	const sortRef = useRef(sort);
	sortRef.current = sort;
	const fetchGenRef = useRef(0);
	const seekCooldownUntilRef = useRef(0);
	const globalRowIndexCacheRef = useRef<Map<number, PersonRow>>(new Map());
	const totalCountRef = useRef(0);
	totalCountRef.current = totalCount;

	const cacheManager = useMemo(
		() =>
			new CacheManager<PersonRow>({
				getStorageEstimate: async () => {
					if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
						const usageBytes = 0;
						const quotaBytes = 50 * 1024 * 1024;
						return {
							usageBytes,
							quotaBytes,
							utilizationRatio: usageBytes / quotaBytes,
						};
					}
					const estimate = await navigator.storage.estimate();
					const usageBytes = estimate.usage ?? 0;
					const quotaBytes = estimate.quota ?? 1;
					return {
						usageBytes,
						quotaBytes,
						utilizationRatio: usageBytes / quotaBytes,
					};
				},
				deleteRows: async (keys) => {
					const keySet = new Set(keys);
					for (const [idx, row] of globalRowIndexCacheRef.current) {
						if (keySet.has(row.id)) {
							globalRowIndexCacheRef.current.delete(idx);
						}
					}
					await collection.utils.receiveSync(
						keys.map((key) => ({ type: "delete", key }) as const),
					);
					setRows((prev) => prev.filter((row) => !keys.includes(row.id)));
				},
			}),
		[collection],
	);

	const bridge = useMemo(() => {
		return new PartialSyncClientBridge<PersonRow>({
			clientId: crypto.randomUUID(),
			collection,
			send: () => {},
			onStateChange: (state) => setBridgeState(state),
			beforeApplyRows: async (incomingRows) => {
				const sortNow = sortRef.current;
				const rowsNow = rowsRef.current;
				cacheManager.recordFetchedRows(incomingRows, (row) => ({
					name: row.name,
					age: row.age,
				}));
				const result = await cacheManager.evictIfNeeded({
					sortColumn: sortNow.column,
					sortDirection: sortNow.direction,
					fromValue:
						rowsNow[0]?.[sortNow.column] ??
						incomingRows[0]?.[sortNow.column] ??
						"",
					toValue:
						rowsNow[rowsNow.length - 1]?.[sortNow.column] ??
						incomingRows[incomingRows.length - 1]?.[sortNow.column] ??
						"",
				});
				setBridgeState((previous) => {
					if (previous.status === "partial" || previous.status === "realtime") {
						return {
							...previous,
							cacheUtilization: result.estimate.utilizationRatio,
						};
					}
					return previous;
				});
			},
		});
	}, [cacheManager, collection]);

	useEffect(() => {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = new URL(
			`${protocol}//${window.location.host}/room/${roomId}/websocket`,
		);
		if (wsTransport === "msgpack") {
			wsUrl.searchParams.set("transport", "msgpack");
		}

		const disconnect = connectPartialSync(bridge, {
			url: wsUrl.toString(),
			transport: wsTransport === "msgpack" ? "msgpack" : "json",
			setTransportSend: (send) => {
				bridge.setSend((message: SyncClientMessage) => send(message));
			},
			serializeJson: (value: unknown) => superjson.stringify(value),
			deserializeJson: (raw: string) => superjson.parse(raw),
		});

		return () => {
			disconnect();
		};
	}, [bridge, roomId, wsTransport]);

	const fetchNext = useCallback(async () => {
		if (loading || !hasMore) return;
		const gen = fetchGenRef.current;
		setLoading(true);
		try {
			const result = await bridge.requestRange(sort, PAGE_LIMIT, nextCursor);
			if (gen !== fetchGenRef.current) return;
			setRows((prev) => {
				const startGlobal = windowStartRef.current + prev.length;
				recordRowsAtGlobalIndices(
					globalRowIndexCacheRef.current,
					startGlobal,
					result.rows,
				);
				return [...prev, ...result.rows];
			});
			setTotalCount(result.totalCount);
			setNextCursor(result.lastCursor);
			setHasMore(result.rows.length === PAGE_LIMIT);
		} catch (error: unknown) {
			if (
				error !== null &&
				typeof error === "object" &&
				"name" in error &&
				error.name === "AbortError"
			) {
				return;
			}
			throw error;
		} finally {
			if (gen === fetchGenRef.current) {
				setLoading(false);
			}
		}
	}, [bridge, hasMore, loading, nextCursor, sort]);

	const seekToViewport = useCallback(
		(
			firstVisibleIndex: number,
			options?: { scrollSettled?: boolean },
		) => {
			const offset = Math.max(0, firstVisibleIndex);
			const loadedEndExclusive = windowStartRef.current + rowsRef.current.length;
			const inDenseWindow =
				rowsRef.current.length > 0 &&
				firstVisibleIndex >= windowStartRef.current &&
				firstVisibleIndex < loadedEndExclusive;

			if (options?.scrollSettled === true && inDenseWindow) {
				return;
			}

			const now = Date.now();
			if (!options?.scrollSettled) {
				const needsCatchUpSeek =
					firstVisibleIndex > loadedEndExclusive + SEEK_ROW_GAP;
				if (!needsCatchUpSeek && now < seekCooldownUntilRef.current) return;
			}
			seekCooldownUntilRef.current = now + SEEK_COOLDOWN_MS;

			setLastSeekMeta({
				offset,
				reason: options?.scrollSettled === true ? "scrollSettled" : "scroll",
			});
			fetchGenRef.current += 1;
			const gen = fetchGenRef.current;
			bridge.abortRangeRequests();

			const cached = trySliceFromGlobalIndexCache(
				globalRowIndexCacheRef.current,
				offset,
				PAGE_LIMIT,
				totalCountRef.current,
			);
			if (cached !== null) {
				setRows(cached);
				setWindowStartIndex(offset);
				const last = cached[cached.length - 1];
				setNextCursor(last !== undefined ? cursorFromRow(last, sort) : null);
				setHasMore(offset + cached.length < totalCountRef.current);
				setLoading(false);
				return;
			}

			setRows([]);
			setWindowStartIndex(offset);
			setNextCursor(null);
			setHasMore(true);
			setLoading(true);
			void (async () => {
				try {
					const result = await bridge.requestByOffset(sort, PAGE_LIMIT, offset);
					if (gen !== fetchGenRef.current) return;
					recordRowsAtGlobalIndices(
						globalRowIndexCacheRef.current,
						offset,
						result.rows,
					);
					setRows(result.rows);
					setWindowStartIndex(offset);
					setTotalCount(result.totalCount);
					setNextCursor(result.lastCursor);
					setHasMore(result.rows.length === PAGE_LIMIT);
				} catch (error: unknown) {
					if (
						error !== null &&
						typeof error === "object" &&
						"name" in error &&
						error.name === "AbortError"
					) {
						return;
					}
					throw error;
				} finally {
					if (gen === fetchGenRef.current) {
						setLoading(false);
					}
				}
			})();
		},
		[bridge, cacheManager, collection, sort],
	);

	const seekAfterScrollSettled = useCallback(
		(firstVisibleIndex: number) => {
			seekToViewport(firstVisibleIndex, { scrollSettled: true });
		},
		[seekToViewport],
	);

	useEffect(() => {
		fetchGenRef.current += 1;
		bridge.abortRangeRequests();
		bridge.clearTrackedRowIds();
		setRows([]);
		setWindowStartIndex(0);
		setTotalCount(0);
		setNextCursor(null);
		setHasMore(true);
		setLastSeekMeta(null);
		globalRowIndexCacheRef.current.clear();
		void collection.utils.truncate();
		cacheManager.clear();
	}, [bridge, cacheManager, collection, sort]);

	useEffect(() => {
		if (rows.length === 0 && !loading && hasMore) {
			void fetchNext();
		}
	}, [fetchNext, hasMore, loading, rows.length]);

	const toggleSort = useCallback(
		(column: "name" | "age") => {
			setSort((prev) => ({
				column,
				direction:
					prev.column === column && prev.direction === "asc" ? "desc" : "asc",
			}));
		},
		[],
	);

	return (
		<section style={{ marginTop: 16 }}>
			<h2 style={{ marginBottom: 4 }}>People ({label})</h2>
			<div style={{ display: "flex", gap: 8 }}>
				<button type="button" onClick={() => toggleSort("name")}>
					Sort by name ({sort.column === "name" ? sort.direction : "asc"})
				</button>
				<button type="button" onClick={() => toggleSort("age")}>
					Sort by age ({sort.column === "age" ? sort.direction : "asc"})
				</button>
			</div>
			<SyncStatusBar
				state={bridgeState}
				totalCount={totalCount}
				cachedCount={bridge.cachedCount}
			/>
			<div
				style={{
					fontSize: 11,
					fontFamily: "monospace",
					color: "#444",
					marginTop: 8,
					lineHeight: 1.4,
				}}
			>
				<div>
					viewport rows (global): [{viewportInfo.firstVisibleIndex},{" "}
					{viewportInfo.lastVisibleIndex}] · dense window: [{windowStartIndex},{" "}
					{windowStartIndex + rows.length}) · total {totalCount.toLocaleString()}
				</div>
				<div>
					last seek: offset {lastSeekMeta?.offset ?? "—"} (
					{lastSeekMeta?.reason ?? "—"}) — replaces only the visible window (rows state);
					collection keeps prior rows; revisiting a range uses an index cache when
					complete (no flash).
				</div>
			</div>
			<PeopleVirtualList
				rows={rows}
				windowStartIndex={windowStartIndex}
				totalCount={totalCount}
				loading={loading}
				onViewportChange={setViewportInfo}
				onNearEnd={() => {
					void fetchNext();
				}}
				onScrollSettled={seekAfterScrollSettled}
			/>
		</section>
	);
}
