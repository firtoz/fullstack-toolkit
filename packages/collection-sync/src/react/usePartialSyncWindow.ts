import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { CacheManager } from "../cache-manager";
import { connectPartialSync } from "../connect-partial-sync";
import { PartialSyncClientBridge } from "../partial-sync-client-bridge";
import type { PartialSyncState } from "../partial-sync-client-bridge";
import type { RangeFingerprint, SyncClientMessage } from "../sync-protocol";
import {
	DEFAULT_PAGE_LIMIT,
	DEFAULT_SEEK_COOLDOWN_MS,
	DEFAULT_SEEK_ROW_GAP,
} from "./constants";
import {
	assertSyncUtils,
	computeFingerprintForIndexWindow,
	defaultPartialSyncVersionMs,
	tryIdsForIndexWindow,
} from "./partial-sync-utils";
import type {
	PartialSyncItem,
	UsePartialSyncWindowOptions,
	UsePartialSyncWindowResult,
	ViewportInfo,
} from "./types";

export {
	DEFAULT_PAGE_LIMIT,
	DEFAULT_SEEK_COOLDOWN_MS,
	DEFAULT_SEEK_ROW_GAP,
} from "./constants";

export function usePartialSyncWindow<
	TItem extends PartialSyncItem,
	TSortColumn extends keyof TItem & string,
>({
	collection,
	sort,
	getSortValue,
	wsUrl,
	wsTransport = "json",
	serializeJson = JSON.stringify,
	deserializeJson = JSON.parse,
	getVersionMs = defaultPartialSyncVersionMs,
	getSortPositions,
	pageLimit = DEFAULT_PAGE_LIMIT,
	seekRowGap = DEFAULT_SEEK_ROW_GAP,
	seekCooldownMs = DEFAULT_SEEK_COOLDOWN_MS,
}: UsePartialSyncWindowOptions<
	TItem,
	TSortColumn
>): UsePartialSyncWindowResult<TItem> {
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

	const globalIndexMapRef = useRef(new Map<number, TItem["id"]>());
	const denseRowsRef = useRef<TItem[]>([]);
	const windowStartRef = useRef(windowStartIndex);
	windowStartRef.current = windowStartIndex;
	const sortRef = useRef(sort);
	sortRef.current = sort;
	const totalCountRef = useRef(totalCount);
	totalCountRef.current = totalCount;
	const fetchGenRef = useRef(0);
	const seekCooldownUntilRef = useRef(0);

	const getSortValueRef = useRef(getSortValue);
	getSortValueRef.current = getSortValue;
	const getSortPositionsRef = useRef(getSortPositions);
	getSortPositionsRef.current = getSortPositions;
	const getVersionMsRef = useRef(getVersionMs);
	getVersionMsRef.current = getVersionMs;

	const bumpIndexMap = useCallback(() => {
		setIndexMapVersion((v) => v + 1);
	}, []);

	const syncUtils = useMemo(
		() => assertSyncUtils<TItem>(collection.utils),
		[collection],
	);

	const cacheManager = useMemo(
		() =>
			new CacheManager<TItem>({
				getStorageEstimate: async () => {
					if (
						typeof navigator === "undefined" ||
						!navigator.storage?.estimate
					) {
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
					await syncUtils.receiveSync(
						keys.map((key) => ({ type: "delete", key }) as const),
					);
				},
			}),
		[syncUtils, bumpIndexMap],
	);

	const bridge = useMemo(
		() =>
			new PartialSyncClientBridge<TItem>({
				clientId: crypto.randomUUID(),
				collection: {
					utils: {
						receiveSync: (messages) => syncUtils.receiveSync(messages),
					},
				},
				send: () => {},
				onStateChange: (state) => setBridgeState(state),
				beforeApplyRows: async (incomingRows) => {
					const sortNow = sortRef.current;
					const rowsNow = denseRowsRef.current;
					const sortPos = getSortPositionsRef.current;
					const gsv = getSortValueRef.current;
					cacheManager.recordFetchedRows(incomingRows, (row) =>
						sortPos !== undefined
							? sortPos(row)
							: {
									[sortNow.column]: gsv(row, sortNow.column),
								},
					);
					const firstRow = rowsNow[0] ?? incomingRows[0];
					const lastRow =
						rowsNow[rowsNow.length - 1] ??
						incomingRows[incomingRows.length - 1];
					const result = await cacheManager.evictIfNeeded({
						sortColumn: sortNow.column as string,
						sortDirection: sortNow.direction,
						fromValue:
							firstRow !== undefined ? gsv(firstRow, sortNow.column) : "",
						toValue: lastRow !== undefined ? gsv(lastRow, sortNow.column) : "",
					});
					setBridgeState((previous) => {
						if (
							previous.status === "partial" ||
							previous.status === "realtime"
						) {
							return {
								...previous,
								cacheUtilization: result.estimate.utilizationRatio,
							};
						}
						return previous;
					});
				},
			}),
		[cacheManager, syncUtils],
	);

	useLayoutEffect(() => {
		const disconnect = connectPartialSync(bridge, {
			url: wsUrl,
			transport: wsTransport,
			setTransportSend: (send) => {
				bridge.setSend((message: SyncClientMessage) => send(message));
			},
			serializeJson,
			deserializeJson,
		});
		return () => {
			disconnect();
		};
	}, [bridge, deserializeJson, serializeJson, wsTransport, wsUrl]);

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
		const out: TItem[] = [];
		for (let i = 0; ; i += 1) {
			const id = globalIndexMapRef.current.get(start + i);
			if (id === undefined) break;
			const row = collection.get(id);
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
		(offset: number, fetchedRows: TItem[]) => {
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
				sort: sortRef.current as { column: string; direction: "asc" | "desc" },
				limit: pageLimit,
				afterCursor: nextCursor,
			});
			if (gen !== fetchGenRef.current) return;

			if (result.invalidateWindow && result.rows.length === 0) {
				const again = await bridge.requestRangeQuery({
					kind: "index",
					mode: "cursor",
					sort: sortRef.current as {
						column: string;
						direction: "asc" | "desc";
					},
					limit: pageLimit,
					afterCursor: nextCursor,
				});
				if (gen !== fetchGenRef.current) return;
				recordIdsAtOffset(
					windowStartRef.current + denseRowsRef.current.length,
					again.rows,
				);
				setTotalCount(again.totalCount);
				setNextCursor(again.lastCursor);
				setHasMore(again.rows.length === pageLimit);
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
			setHasMore(result.rows.length === pageLimit);
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
	}, [bridge, hasMore, loading, nextCursor, pageLimit, recordIdsAtOffset]);

	const seekToViewport = useCallback(
		(firstVisibleIndex: number, options?: { scrollSettled?: boolean }) => {
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
					firstVisibleIndex > loadedEndExclusive + seekRowGap;
				if (!needsCatchUpSeek && now < seekCooldownUntilRef.current) return;
			}
			seekCooldownUntilRef.current = now + seekCooldownMs;

			setLastSeekMeta({
				offset,
				reason: options?.scrollSettled === true ? "scrollSettled" : "scroll",
			});
			fetchGenRef.current += 1;
			const gen = fetchGenRef.current;
			bridge.abortRangeRequests();

			const want = Math.min(
				pageLimit,
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
				const gsv = getSortValueRef.current;
				const lastRow =
					lastId !== undefined ? collection.get(lastId) : undefined;
				setNextCursor(
					lastRow !== undefined ? gsv(lastRow, sortRef.current.column) : null,
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
					(row) => getVersionMsRef.current(row),
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
							sort: sortRef.current as {
								column: string;
								direction: "asc" | "desc";
							},
							limit: pageLimit,
							offset,
						},
						fingerprint,
					);
					if (gen !== fetchGenRef.current) return;

					if (result.upToDate) {
						setTotalCount(result.totalCount);
						setHasMore(offset + pageLimit < result.totalCount);
						const gsv = getSortValueRef.current;
						const lastId =
							globalIndexMapRef.current.get(offset + want - 1) ??
							globalIndexMapRef.current.get(offset + pageLimit - 1);
						const lastRow =
							lastId !== undefined ? collection.get(lastId) : undefined;
						setNextCursor(
							lastRow !== undefined
								? gsv(lastRow, sortRef.current.column)
								: null,
						);
						return;
					}

					if (result.invalidateWindow && result.rows.length === 0) {
						result = await bridge.requestRangeQuery({
							kind: "index",
							mode: "offset",
							sort: sortRef.current as {
								column: string;
								direction: "asc" | "desc";
							},
							limit: pageLimit,
							offset,
						});
						if (gen !== fetchGenRef.current) return;
					}

					recordIdsAtOffset(offset, result.rows);
					setTotalCount(result.totalCount);
					setNextCursor(result.lastCursor);
					setHasMore(result.rows.length === pageLimit);
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
		[
			bridge,
			bumpIndexMap,
			collection,
			pageLimit,
			recordIdsAtOffset,
			seekCooldownMs,
			seekRowGap,
		],
	);

	const seekAfterScrollSettled = useCallback(
		(firstVisibleIndex: number) => {
			seekToViewport(firstVisibleIndex, { scrollSettled: true });
		},
		[seekToViewport],
	);

	// Re-run when `collection` or `sort` identity changes (new backend / sort column).
	// biome-ignore lint/correctness/useExhaustiveDependencies: collection + sort intentionally reset the window
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
		void syncUtils.truncate();
		cacheManager.clear();
	}, [bridge, bumpIndexMap, cacheManager, collection, sort, syncUtils]);

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
