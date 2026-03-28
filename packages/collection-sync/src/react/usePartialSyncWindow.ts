import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { CacheManager } from "../cache-manager";
import { connectPartialSync } from "../connect-partial-sync";
import {
	PartialSyncClientBridge,
	type PartialSyncRangePatchAppliedEvent,
	type PartialSyncState,
} from "../partial-sync-client-bridge";
import type { RangeFingerprint, SyncClientMessage } from "../sync-protocol";
import { DEFAULT_PAGE_LIMIT, DEFAULT_SEEK_COOLDOWN_MS } from "./constants";
import { partialSyncRowKey } from "../partial-sync-row-key";
import {
	assertSyncUtils,
	computeFingerprintForIndexWindow,
	defaultPartialSyncVersionMs,
	getPartialSyncRowByMapId,
	tryIdsForIndexWindow,
} from "./partial-sync-utils";
import type {
	PartialSyncItem,
	PartialSyncRowSlotView,
	UsePartialSyncWindowOptions,
	UsePartialSyncWindowResult,
	ViewportInfo,
} from "./types";

export {
	DEFAULT_PAGE_LIMIT,
	DEFAULT_SEEK_COOLDOWN_MS,
	DEFAULT_SEEK_ROW_GAP,
	DEFAULT_VIEWPORT_RANGE_MAX_WAIT_MS,
	DEFAULT_VIEWPORT_RANGE_QUIET_MS,
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
	seekCooldownMs = DEFAULT_SEEK_COOLDOWN_MS,
	partialWindowResetKey,
	mutationBridge,
	mergeTransportSend,
	collectionId,
	cacheDisplayMode = "immediate",
}: UsePartialSyncWindowOptions<
	TItem,
	TSortColumn
>): UsePartialSyncWindowResult<TItem> {
	const [windowStartIndex, setWindowStartIndex] = useState(0);
	const [totalCount, setTotalCount] = useState(0);
	const [nextCursor, setNextCursor] = useState<unknown | null>(null);
	const [hasMore, setHasMore] = useState(true);
	/** True only while `requestRangeQuery` is in flight (server). Not set for cache-only window moves. */
	const [rangeRequestInFlight, setRangeRequestInFlight] = useState(false);
	const [pendingServerRange, setPendingServerRange] = useState<{
		start: number;
		endExclusive: number;
	} | null>(null);
	const [bridgeState, setBridgeState] = useState<PartialSyncState>({
		status: "offline",
	});
	const [viewportInfo, setViewportInfo] = useState<ViewportInfo>({
		firstVisibleIndex: 0,
		lastVisibleIndex: 0,
	});
	const viewportInfoRef = useRef(viewportInfo);
	viewportInfoRef.current = viewportInfo;
	const [lastSeekMeta, setLastSeekMeta] = useState<{
		offset: number;
		reason: "scroll" | "scrollSettled";
	} | null>(null);
	const [collectionVersion, setCollectionVersion] = useState(0);
	const [indexMapVersion, setIndexMapVersion] = useState(0);

	const globalIndexMapRef = useRef(new Map<number, string | number>());
	const denseRowsRef = useRef<TItem[]>([]);
	const windowStartRef = useRef(windowStartIndex);
	windowStartRef.current = windowStartIndex;
	const sortRef = useRef(sort);
	sortRef.current = sort;
	const totalCountRef = useRef(totalCount);
	totalCountRef.current = totalCount;
	const fetchGenRef = useRef(0);
	const seekCooldownUntilRef = useRef(0);
	const seekToViewportRef = useRef<
		(
			firstVisibleIndex: number,
			opts?: {
				scrollSettled?: boolean;
				lastVisibleIndex?: number;
				force?: boolean;
			},
		) => void
	>(() => {});
	const invalidateSeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	const getSortValueRef = useRef(getSortValue);
	getSortValueRef.current = getSortValue;
	const getSortPositionsRef = useRef(getSortPositions);
	getSortPositionsRef.current = getSortPositions;
	const getVersionMsRef = useRef(getVersionMs);
	getVersionMsRef.current = getVersionMs;

	const serializeJsonRef = useRef(serializeJson);
	serializeJsonRef.current = serializeJson;
	const deserializeJsonRef = useRef(deserializeJson);
	deserializeJsonRef.current = deserializeJson;

	const bumpIndexMap = useCallback(() => {
		setIndexMapVersion((v) => v + 1);
	}, []);

	const syncUtils = useMemo(
		() => assertSyncUtils<TItem>(collection.utils),
		[collection],
	);

	const syncUtilsRef = useRef(syncUtils);
	syncUtilsRef.current = syncUtils;

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
					const keySet = new Set<string | number>();
					for (const k of keys) {
						keySet.add(k);
						keySet.add(String(k));
					}
					for (const [idx, id] of globalIndexMapRef.current) {
						if (
							keySet.has(id) ||
							keySet.has(String(id)) ||
							(typeof id === "string" &&
								/^-?\d+$/.test(id) &&
								keySet.has(Number(id)))
						) {
							globalIndexMapRef.current.delete(idx);
						}
					}
					bumpIndexMap();
					await syncUtilsRef.current.receiveSync(
						keys.map((key) => ({ type: "delete", key }) as const),
					);
				},
			}),
		[bumpIndexMap],
	);

	const cacheManagerRef = useRef(cacheManager);
	cacheManagerRef.current = cacheManager;

	// Bridge identity must stay stable: `connectPartialSync` runs in layout effect and
	// calls `setConnecting` / `setConnected`, which updates React state. If `bridge`
	// were recreated whenever `collection` (hence syncUtils/cacheManager) changed,
	// that effect would re-run every render → infinite updates.
	const partialClientId = mutationBridge?.clientId;

	const bridge = useMemo(
		() =>
			new PartialSyncClientBridge<TItem>({
				...(partialClientId !== undefined ? { clientId: partialClientId } : {}),
				...(collectionId !== undefined ? { collectionId } : {}),
				collection: {
					utils: {
						receiveSync: (messages) =>
							syncUtilsRef.current.receiveSync(messages),
					},
				},
				send: () => {},
				onStateChange: (state) => setBridgeState(state),
				beforeApplyRows: async (incomingRows) => {
					const sortNow = sortRef.current;
					const rowsNow = denseRowsRef.current;
					const sortPos = getSortPositionsRef.current;
					const gsv = getSortValueRef.current;
					const cm = cacheManagerRef.current;
					cm.recordFetchedRows(incomingRows, (row) =>
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
					const result = await cm.evictIfNeeded({
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
				onViewTransition: (e) => {
					if (e.type === "exitView" && e.change.type === "update") {
						const key = partialSyncRowKey(e.change.value.id);
						let removed = false;
						for (const [idx, mappedId] of [
							...globalIndexMapRef.current.entries(),
						]) {
							if (mappedId === key) {
								globalIndexMapRef.current.delete(idx);
								removed = true;
							}
						}
						if (removed) {
							bumpIndexMap();
						}
					}
				},
				onRangePatchApplied: ({
					change,
					viewTransition,
				}: PartialSyncRangePatchAppliedEvent<TItem>) => {
					if (change.type !== "update" || viewTransition !== undefined) {
						return;
					}
					if (change.previousValue === undefined) return;
					const col = sortRef.current.column;
					const gsv = getSortValueRef.current;
					if (
						gsv(change.previousValue as TItem, col) === gsv(change.value, col)
					) {
						return;
					}
					const rowKey = partialSyncRowKey(change.value.id);
					const inDense = denseRowsRef.current.some(
						(r) => partialSyncRowKey(r.id) === rowKey,
					);
					if (!inDense) return;
					if (invalidateSeekTimerRef.current !== null) {
						clearTimeout(invalidateSeekTimerRef.current);
					}
					invalidateSeekTimerRef.current = setTimeout(() => {
						invalidateSeekTimerRef.current = null;
						seekToViewportRef.current(
							viewportInfoRef.current.firstVisibleIndex,
							{
								force: true,
							},
						);
					}, 80);
				},
			}),
		[partialClientId, collectionId, bumpIndexMap],
	);

	// Do not list serializeJson / deserializeJson as effect deps: callers often pass
	// inline lambdas (new reference every render). That would re-run this layout effect
	// every time → cleanup calls setConnected(false) and the next run calls setConnecting,
	// each firing onStateChange → maximum update depth exceeded.
	const mutationBridgeRef = useRef(mutationBridge);
	mutationBridgeRef.current = mutationBridge;

	const mergeTransportSendRef = useRef(mergeTransportSend);
	mergeTransportSendRef.current = mergeTransportSend;

	useLayoutEffect(() => {
		const disconnect = connectPartialSync(bridge, {
			url: wsUrl,
			transport: wsTransport,
			setTransportSend: (send) => {
				bridge.setSend((message: SyncClientMessage) => send(message));
				mergeTransportSendRef.current?.(send);
			},
			serializeJson: (value: unknown) => serializeJsonRef.current(value),
			deserializeJson: (raw: string) => deserializeJsonRef.current(raw),
			mutationBridge: mutationBridgeRef.current,
		});
		return () => {
			disconnect();
		};
	}, [bridge, wsTransport, wsUrl]);

	const confirmedKeysRevision = useSyncExternalStore(
		(onStoreChange) => bridge.subscribeConfirmedKeysRevision(onStoreChange),
		() => bridge.serverConfirmedKeysRevision,
		() => 0,
	);

	const indexRows = useMemo(() => {
		void collectionVersion;
		void indexMapVersion;
		void confirmedKeysRevision;
		const start = windowStartIndex;
		const out: TItem[] = [];
		for (let i = 0; ; i += 1) {
			const id = globalIndexMapRef.current.get(start + i);
			if (id === undefined) break;
			const row = getPartialSyncRowByMapId(collection, id);
			if (row === undefined) continue;
			out.push(row);
		}
		if (cacheDisplayMode === "confirmed") {
			return out.filter((row) =>
				bridge.serverConfirmedKeys.has(partialSyncRowKey(row.id)),
			);
		}
		return out;
	}, [
		bridge,
		cacheDisplayMode,
		collection,
		collectionVersion,
		confirmedKeysRevision,
		indexMapVersion,
		windowStartIndex,
	]);

	const rows = indexRows;

	useLayoutEffect(() => {
		denseRowsRef.current = rows;
	}, [rows]);

	const getRowSlot = useCallback(
		(globalIndex: number): PartialSyncRowSlotView<TItem> => {
			void collectionVersion;
			void indexMapVersion;
			const id = globalIndexMapRef.current.get(globalIndex);
			const row =
				id !== undefined ? getPartialSyncRowByMapId(collection, id) : undefined;
			if (row !== undefined) {
				const ws = windowStartIndex;
				const denseEnd = ws + rows.length;
				const inDense = globalIndex >= ws && globalIndex < denseEnd;
				return {
					row,
					slot: inDense ? "ready" : "ready_global",
				};
			}
			if (id !== undefined) {
				return { row: undefined, slot: "stale_map" };
			}
			if (
				rangeRequestInFlight &&
				pendingServerRange !== null &&
				globalIndex >= pendingServerRange.start &&
				globalIndex < pendingServerRange.endExclusive
			) {
				return { row: undefined, slot: "server" };
			}
			return { row: undefined, slot: "none" };
		},
		[
			collection,
			collectionVersion,
			indexMapVersion,
			windowStartIndex,
			rows.length,
			rangeRequestInFlight,
			pendingServerRange,
		],
	);

	const recordIdsAtOffset = useCallback(
		(offset: number, fetchedRows: TItem[]) => {
			for (let i = 0; i < fetchedRows.length; i += 1) {
				globalIndexMapRef.current.set(
					offset + i,
					partialSyncRowKey(fetchedRows[i].id),
				);
			}
			bumpIndexMap();
		},
		[bumpIndexMap],
	);

	const fetchNext = useCallback(async () => {
		if (rangeRequestInFlight || !hasMore) return;
		const gen = fetchGenRef.current;
		const fetchStart = windowStartRef.current + denseRowsRef.current.length;
		setPendingServerRange({
			start: fetchStart,
			endExclusive: fetchStart + pageLimit,
		});
		setRangeRequestInFlight(true);
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
				setPendingServerRange(null);
				setRangeRequestInFlight(false);
			}
		}
	}, [
		bridge,
		hasMore,
		rangeRequestInFlight,
		nextCursor,
		pageLimit,
		recordIdsAtOffset,
	]);

	const seekToViewport = useCallback(
		(
			firstVisibleIndex: number,
			options?: {
				scrollSettled?: boolean;
				lastVisibleIndex?: number;
				force?: boolean;
			},
		) => {
			const offset = Math.max(0, firstVisibleIndex);
			const loadedEndExclusive =
				windowStartRef.current + denseRowsRef.current.length;
			// For scrollSettled, `lastVisibleIndex` comes from scroll geometry (viewport height), not
			// TanStack overscan — safe to require the whole visible span to fit in the dense window.
			// Without last, keep first-only (e.g. non-settled callers).
			const lastForDense =
				options?.scrollSettled === true &&
				typeof options.lastVisibleIndex === "number"
					? options.lastVisibleIndex
					: firstVisibleIndex;
			const inDenseWindow =
				denseRowsRef.current.length > 0 &&
				firstVisibleIndex >= windowStartRef.current &&
				lastForDense < loadedEndExclusive;

			if (options?.scrollSettled === true && inDenseWindow && !options?.force) {
				return;
			}

			const now = Date.now();
			if (!options?.force && now < seekCooldownUntilRef.current) {
				return;
			}
			if (!options?.scrollSettled) {
				// Live scroll: virtualizer updates indices before `windowStartIndex` catches up (seek was
				// scrollSettled-only). If the first visible row is outside [windowStart, loadedEnd), reconcile
				// immediately (throttled) so we do not paint "not cached yet" until scrollend.
				const ws = windowStartRef.current;
				const f = firstVisibleIndex;
				const firstInsideDense =
					denseRowsRef.current.length > 0 && f >= ws && f < loadedEndExclusive;
				if (firstInsideDense && !options?.force) return;
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
				windowStartRef.current = offset;
				setNextCursor(null);
				setHasMore(false);
				setPendingServerRange(null);
				setRangeRequestInFlight(false);
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
					lastId !== undefined
						? getPartialSyncRowByMapId(collection, lastId)
						: undefined;
				setNextCursor(
					lastRow !== undefined ? gsv(lastRow, sortRef.current.column) : null,
				);
				setHasMore(offset + ids.length < totalCountRef.current);
				setPendingServerRange(null);
				bumpIndexMap();
				windowStartRef.current = offset;
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
			windowStartRef.current = offset;
			setNextCursor(null);
			setHasMore(true);
			setPendingServerRange({ start: offset, endExclusive: offset + want });
			setRangeRequestInFlight(true);
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
							lastId !== undefined
								? getPartialSyncRowByMapId(collection, lastId)
								: undefined;
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
						setPendingServerRange(null);
						setRangeRequestInFlight(false);
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
		],
	);

	seekToViewportRef.current = seekToViewport;

	useEffect(() => {
		return () => {
			if (invalidateSeekTimerRef.current !== null) {
				clearTimeout(invalidateSeekTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const sub = collection.subscribeChanges(() => {
			// Remove individual stale map entries (row deleted from collection, but map still
			// references it). This is lightweight: no wholesale clear, no force-seek, no abort.
			// `indexRows` already skips stale entries so the UI stays populated.
			let removedStaleMapEntry = false;
			if (globalIndexMapRef.current.size > 0) {
				for (const [idx, id] of globalIndexMapRef.current) {
					if (getPartialSyncRowByMapId(collection, id) === undefined) {
						globalIndexMapRef.current.delete(idx);
						removedStaleMapEntry = true;
					}
				}
			}
			if (removedStaleMapEntry) {
				bumpIndexMap();
			}

			setCollectionVersion((v) => v + 1);
			const sortNow = sortRef.current;
			const sortPos = getSortPositionsRef.current;
			const gsv = getSortValueRef.current;
			cacheManagerRef.current.resyncSortPositionsForTrackedRows(
				(key) => getPartialSyncRowByMapId(collection, key),
				(row) =>
					sortPos !== undefined
						? sortPos(row)
						: {
								[sortNow.column]: gsv(row, sortNow.column),
							},
			);
		});
		return () => {
			sub.unsubscribe();
		};
	}, [bumpIndexMap, collection]);

	const seekAfterScrollSettled = useCallback(
		(firstVisibleIndex: number, lastVisibleIndex?: number) => {
			seekToViewport(firstVisibleIndex, {
				scrollSettled: true,
				lastVisibleIndex,
			});
		},
		[seekToViewport],
	);

	// Re-run when sort or logical collection identity changes — not on TanStack `collection` ref churn.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional narrow deps; truncate uses syncUtilsRef
	useEffect(() => {
		fetchGenRef.current += 1;
		bridge.abortRangeRequests();
		bridge.clearTrackedRowIds();
		setWindowStartIndex(0);
		setTotalCount(0);
		setNextCursor(null);
		setHasMore(true);
		setLastSeekMeta(null);
		setRangeRequestInFlight(false);
		setPendingServerRange(null);
		globalIndexMapRef.current.clear();
		bumpIndexMap();
		void syncUtilsRef.current.truncate();
		cacheManager.clear();
	}, [
		bridge,
		bumpIndexMap,
		cacheManager,
		sort.column,
		sort.direction,
		partialWindowResetKey ?? "",
	]);

	useEffect(() => {
		if (rows.length === 0 && !rangeRequestInFlight && hasMore) {
			void fetchNext();
		}
	}, [fetchNext, hasMore, rangeRequestInFlight, rows.length]);

	return {
		bridge,
		cacheManager,
		rows,
		windowStartIndex,
		totalCount,
		rangeRequestInFlight,
		hasMore,
		fetchNext,
		seekToViewport,
		seekAfterScrollSettled,
		bridgeState,
		viewportInfo,
		setViewportInfo,
		lastSeekMeta,
		getRowSlot,
	};
}
