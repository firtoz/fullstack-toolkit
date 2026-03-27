import {
	CacheManager,
	PartialSyncClientBridge,
	type PartialSyncState,
	type RangeCondition,
	type RangeFingerprint,
} from "@firtoz/collection-sync";
import type { SyncMessage } from "@firtoz/db-helpers";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { ViewportInfo } from "./PeopleVirtualList";
import type { PeoplePartialSyncCollection, PersonRow, SortState } from "./types";
import {
	computeFingerprintForIndexWindow,
	matchesPredicate,
	parsePersonRow,
	tryIdsForIndexWindow,
} from "./partial-sync-window-utils";

const PAGE_LIMIT = 50;
export const SEEK_ROW_GAP = 80;
export const SEEK_COOLDOWN_MS = 200;

type UsePartialSyncWindowOptions = {
	collection: PeoplePartialSyncCollection;
	sort: SortState;
};

function peopleSyncUtils(collection: PeoplePartialSyncCollection) {
	return collection.utils as {
		receiveSync: (messages: SyncMessage<PersonRow>[]) => Promise<void>;
		truncate: () => Promise<void>;
	};
}

function cursorFromRow(row: PersonRow, sort: SortState): unknown {
	return sort.column === "age" ? row.age : row.name;
}

export function usePartialSyncWindow({
	collection,
	sort,
}: UsePartialSyncWindowOptions) {
	const [windowStartIndex, setWindowStartIndex] = useState(0);
	const [totalCount, setTotalCount] = useState(0);
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
	const [collectionVersion, setCollectionVersion] = useState(0);
	const [indexMapVersion, setIndexMapVersion] = useState(0);

	const globalIndexMapRef = useRef<Map<number, PersonRow["id"]>>(new Map());
	const denseRowsRef = useRef<PersonRow[]>([]);
	const windowStartRef = useRef(windowStartIndex);
	windowStartRef.current = windowStartIndex;
	const sortRef = useRef(sort);
	sortRef.current = sort;
	const totalCountRef = useRef(totalCount);
	totalCountRef.current = totalCount;
	const fetchGenRef = useRef(0);
	const seekCooldownUntilRef = useRef(0);

	const bumpIndexMap = useCallback(() => {
		setIndexMapVersion((v) => v + 1);
	}, []);

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
					for (const [idx, id] of globalIndexMapRef.current) {
						if (keySet.has(id)) {
							globalIndexMapRef.current.delete(idx);
						}
					}
					bumpIndexMap();
					await peopleSyncUtils(collection).receiveSync(
						keys.map((key) => ({ type: "delete", key }) as const),
					);
				},
			}),
		[collection, bumpIndexMap],
	);

	const bridge = useMemo(
		() =>
			new PartialSyncClientBridge<PersonRow>({
				clientId: crypto.randomUUID(),
				collection: {
					utils: {
						receiveSync: (messages) =>
							peopleSyncUtils(collection).receiveSync(messages),
					},
				},
				send: () => {},
				onStateChange: (state) => setBridgeState(state),
				beforeApplyRows: async (incomingRows) => {
					const sortNow = sortRef.current;
					const rowsNow = denseRowsRef.current;
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
			}),
		[cacheManager, collection],
	);

	useEffect(() => {
		const sub = collection.subscribeChanges(() => {
			setCollectionVersion((v) => v + 1);
		});
		return () => {
			sub.unsubscribe();
		};
	}, [collection]);

	const indexRows = useMemo(() => {
		void collectionVersion;
		void indexMapVersion;
		const start = windowStartIndex;
		const out: PersonRow[] = [];
		for (let i = 0; ; i += 1) {
			const id = globalIndexMapRef.current.get(start + i);
			if (id === undefined) break;
			const row = parsePersonRow(collection.get(id));
			if (row === undefined) break;
			out.push(row);
		}
		return out;
	}, [collection, collectionVersion, indexMapVersion, windowStartIndex]);

	const rows = indexRows;

	useLayoutEffect(() => {
		denseRowsRef.current = rows;
	}, [rows]);

	const recordIdsAtOffset = useCallback(
		(offset: number, fetchedRows: PersonRow[]) => {
			for (let i = 0; i < fetchedRows.length; i += 1) {
				globalIndexMapRef.current.set(offset + i, fetchedRows[i].id);
			}
			bumpIndexMap();
		},
		[bumpIndexMap],
	);

	const fetchNext = useCallback(async () => {
		if (loading || !hasMore) return;
		const gen = fetchGenRef.current;
		setLoading(true);
		try {
			const result = await bridge.requestRangeQuery({
				kind: "index",
				mode: "cursor",
				sort: sortRef.current,
				limit: PAGE_LIMIT,
				afterCursor: nextCursor,
			});
			if (gen !== fetchGenRef.current) return;

			if (result.invalidateWindow && result.rows.length === 0) {
				const again = await bridge.requestRangeQuery({
					kind: "index",
					mode: "cursor",
					sort: sortRef.current,
					limit: PAGE_LIMIT,
					afterCursor: nextCursor,
				});
				if (gen !== fetchGenRef.current) return;
				recordIdsAtOffset(
					windowStartRef.current + denseRowsRef.current.length,
					again.rows,
				);
				setTotalCount(again.totalCount);
				setNextCursor(again.lastCursor);
				setHasMore(again.rows.length === PAGE_LIMIT);
				return;
			}

			if (result.upToDate) {
				setTotalCount(result.totalCount);
				return;
			}

			recordIdsAtOffset(
				windowStartRef.current + denseRowsRef.current.length,
				result.rows,
			);
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
	}, [bridge, hasMore, loading, nextCursor, recordIdsAtOffset]);

	const seekToViewport = useCallback(
		(
			firstVisibleIndex: number,
			options?: { scrollSettled?: boolean },
		) => {
			const offset = Math.max(0, firstVisibleIndex);
			const loadedEndExclusive =
				windowStartRef.current + denseRowsRef.current.length;
			const inDenseWindow =
				denseRowsRef.current.length > 0 &&
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

			const want = Math.min(
				PAGE_LIMIT,
				Math.max(0, totalCountRef.current - offset),
			);
			if (totalCountRef.current > 0 && want === 0) {
				setWindowStartIndex(offset);
				setNextCursor(null);
				setHasMore(false);
				setLoading(false);
				return;
			}

			const ids = tryIdsForIndexWindow(
				globalIndexMapRef.current,
				offset,
				want,
				totalCountRef.current,
			);
			if (ids !== null) {
				setWindowStartIndex(offset);
				const lastId = ids[ids.length - 1];
				const lastRow =
					lastId !== undefined ? parsePersonRow(collection.get(lastId)) : undefined;
				setNextCursor(
					lastRow !== undefined ? cursorFromRow(lastRow, sortRef.current) : null,
				);
				setHasMore(offset + ids.length < totalCountRef.current);
				setLoading(false);
				bumpIndexMap();
				return;
			}

			let fingerprint: RangeFingerprint | undefined;
			if (totalCountRef.current > 0 && want > 0) {
				const fp = computeFingerprintForIndexWindow(
					collection,
					globalIndexMapRef.current,
					offset,
					want,
				);
				if (fp !== undefined) {
					fingerprint = fp;
				}
			}

			setWindowStartIndex(offset);
			setNextCursor(null);
			setHasMore(true);
			setLoading(true);
			void (async () => {
				try {
					let result = await bridge.requestRangeQuery(
						{
							kind: "index",
							mode: "offset",
							sort: sortRef.current,
							limit: PAGE_LIMIT,
							offset,
						},
						fingerprint,
					);
					if (gen !== fetchGenRef.current) return;

					if (result.upToDate) {
						setTotalCount(result.totalCount);
						setHasMore(offset + PAGE_LIMIT < result.totalCount);
						const lastId =
							globalIndexMapRef.current.get(offset + want - 1) ??
							globalIndexMapRef.current.get(offset + PAGE_LIMIT - 1);
						const lastRow =
							lastId !== undefined
								? parsePersonRow(collection.get(lastId))
								: undefined;
						setNextCursor(
							lastRow !== undefined
								? cursorFromRow(lastRow, sortRef.current)
								: null,
						);
						return;
					}

					if (result.invalidateWindow && result.rows.length === 0) {
						result = await bridge.requestRangeQuery({
							kind: "index",
							mode: "offset",
							sort: sortRef.current,
							limit: PAGE_LIMIT,
							offset,
						});
						if (gen !== fetchGenRef.current) return;
					}

					recordIdsAtOffset(offset, result.rows);
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
		[bridge, bumpIndexMap, collection, recordIdsAtOffset],
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
		setWindowStartIndex(0);
		setTotalCount(0);
		setNextCursor(null);
		setHasMore(true);
		setLastSeekMeta(null);
		globalIndexMapRef.current.clear();
		bumpIndexMap();
		void peopleSyncUtils(collection).truncate();
		cacheManager.clear();
	}, [bridge, bumpIndexMap, cacheManager, collection, sort]);

	useEffect(() => {
		if (rows.length === 0 && !loading && hasMore) {
			void fetchNext();
		}
	}, [fetchNext, hasMore, loading, rows.length]);

	return {
		bridge,
		cacheManager,
		rows,
		windowStartIndex,
		totalCount,
		loading,
		hasMore,
		fetchNext,
		seekToViewport,
		seekAfterScrollSettled,
		bridgeState,
		viewportInfo,
		setViewportInfo,
		lastSeekMeta,
	};
}

/**
 * Client-side predicate filter over the collection (e.g. spatial / MMO-style ranges).
 * Combine with {@link PartialSyncClientBridge.requestRangeQuery} using `kind: "predicate"` to hydrate from the server.
 */
export function usePredicateFilteredRows(
	collection: PeoplePartialSyncCollection,
	conditions: RangeCondition[],
	sort: SortState,
	limit: number = PAGE_LIMIT,
): PersonRow[] {
	const [collectionVersion, setCollectionVersion] = useState(0);
	useEffect(() => {
		const sub = collection.subscribeChanges(() => {
			setCollectionVersion((v) => v + 1);
		});
		return () => {
			sub.unsubscribe();
		};
	}, [collection]);
	return useMemo(() => {
		void collectionVersion;
		const out: PersonRow[] = [];
		for (const [, raw] of collection.entries()) {
			const row = parsePersonRow(raw);
			if (row !== undefined && matchesPredicate(row, conditions)) {
				out.push(row);
			}
		}
		out.sort((a, b) => {
			const av = sort.column === "age" ? a.age : a.name;
			const bv = sort.column === "age" ? b.age : b.name;
			const cmp =
				typeof av === "number" && typeof bv === "number"
					? av === bv
						? 0
						: av < bv
							? -1
							: 1
					: String(av).localeCompare(String(bv));
			return sort.direction === "asc" ? cmp : -cmp;
		});
		return out.slice(0, limit);
	}, [collection, collectionVersion, conditions, limit, sort]);
}

export { matchesPredicate } from "./partial-sync-window-utils";

