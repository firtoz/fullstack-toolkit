import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { SyncRange } from "../sync-protocol";
import {
	DEFAULT_VIEWPORT_RANGE_MAX_WAIT_MS,
	DEFAULT_VIEWPORT_RANGE_QUIET_MS,
} from "./constants";
import { usePredicateFilteredRows } from "./usePredicateFilteredRows";
import type {
	PartialSyncItem,
	UsePartialSyncViewportOptions,
	UsePartialSyncViewportResult,
} from "./types";

/**
 * Predicate viewport sync: debounced server `rangeQuery` for a moving logical viewport plus
 * {@link usePredicateFilteredRows} for the visible rows already in the local collection.
 */
export function usePartialSyncViewport<
	TItem extends PartialSyncItem,
	TViewport,
	TSortColumn extends keyof TItem & string,
>({
	bridge,
	bridgeState,
	collection,
	adapter,
	viewport,
	predicateLimit,
	prefetchPad = 0,
	quietMs = DEFAULT_VIEWPORT_RANGE_QUIET_MS,
	maxWaitMs = DEFAULT_VIEWPORT_RANGE_MAX_WAIT_MS,
	totalCountFallback = 0,
	getColumnValue,
	cacheDisplayMode = "immediate",
	alwaysIncludeRowIds,
	onRangeReconcile,
}: UsePartialSyncViewportOptions<
	TItem,
	TViewport,
	TSortColumn
>): UsePartialSyncViewportResult<TItem> {
	const conditions = useMemo(
		() => adapter.toConditions(viewport),
		[adapter, viewport],
	);

	const confirmedKeysRevision = useSyncExternalStore(
		(onStoreChange) => bridge.subscribeConfirmedKeysRevision(onStoreChange),
		() => bridge.serverConfirmedKeysRevision,
		() => 0,
	);

	const viewportRows = usePredicateFilteredRows({
		collection,
		conditions,
		sort: adapter.sort,
		getSortValue: adapter.getSortValue,
		...(getColumnValue !== undefined ? { getColumnValue } : {}),
		limit: predicateLimit,
		cacheDisplayMode,
		...(alwaysIncludeRowIds !== undefined && alwaysIncludeRowIds.length > 0
			? { alwaysIncludeRowIds }
			: {}),
		...(cacheDisplayMode === "confirmed"
			? {
					confirmedRowKeys: bridge.serverConfirmedKeys,
					confirmedKeysRevision,
				}
			: {}),
	});

	const fetchViewport = useMemo(
		() => adapter.expandViewport(viewport, prefetchPad),
		[adapter, prefetchPad, viewport],
	);

	const bridgeRef = useRef(bridge);
	bridgeRef.current = bridge;
	const adapterRef = useRef(adapter);
	adapterRef.current = adapter;
	const fetchViewportRef = useRef(fetchViewport);
	fetchViewportRef.current = fetchViewport;
	const predicateLimitRef = useRef(predicateLimit);
	predicateLimitRef.current = predicateLimit;

	const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastRangeFetchAtRef = useRef(0);

	const collectionRef = useRef(collection);
	collectionRef.current = collection;
	const onRangeReconcileRef = useRef(onRangeReconcile);
	onRangeReconcileRef.current = onRangeReconcile;

	function canReconcileWithManifest(): boolean {
		const col = collectionRef.current;
		if (typeof col.get !== "function") return false;
		const keys = bridgeRef.current.serverConfirmedKeys;
		if (keys.size === 0) return false;
		for (const k of keys) {
			let row = col.get(k);
			if (row === undefined && typeof k === "number") {
				row = col.get(String(k));
			} else if (row === undefined && typeof k === "string") {
				const n = Number(k);
				if (!Number.isNaN(n)) row = col.get(n);
			}
			if (row !== undefined) return true;
		}
		return false;
	}

	useLayoutEffect(() => {
		const clearQuietTimer = () => {
			if (quietTimerRef.current !== null) {
				clearTimeout(quietTimerRef.current);
				quietTimerRef.current = null;
			}
		};
		const clearMaxWaitTimer = () => {
			if (maxWaitTimerRef.current !== null) {
				clearTimeout(maxWaitTimerRef.current);
				maxWaitTimerRef.current = null;
			}
		};

		const runRangeQuery = () => {
			clearQuietTimer();
			clearMaxWaitTimer();
			lastRangeFetchAtRef.current = performance.now();
			const v = fetchViewportRef.current;
			const ad = adapterRef.current;
			const range: SyncRange = {
				kind: "predicate",
				conditions: ad.toConditions(v),
				sort: ad.sort,
				limit: predicateLimitRef.current,
			};
			if (canReconcileWithManifest()) {
				void bridgeRef.current
					.requestRangeReconcile(range)
					.then((rec) => {
						onRangeReconcileRef.current?.(rec);
					})
					.catch((err: unknown) => {
						console.error("partial sync viewport rangeReconcile failed", err);
					});
				return;
			}
			void bridgeRef.current.requestRangeQuery(range).catch((err: unknown) => {
				console.error("partial sync viewport rangeQuery failed", err);
			});
		};

		clearQuietTimer();
		clearMaxWaitTimer();

		const now = performance.now();
		const sinceLastFetch = now - lastRangeFetchAtRef.current;
		const fetchImmediately =
			lastRangeFetchAtRef.current === 0 || sinceLastFetch >= maxWaitMs;

		if (fetchImmediately) {
			runRangeQuery();
			return () => {
				clearQuietTimer();
				clearMaxWaitTimer();
			};
		}

		quietTimerRef.current = setTimeout(runRangeQuery, quietMs);
		maxWaitTimerRef.current = setTimeout(
			runRangeQuery,
			Math.max(0, maxWaitMs - sinceLastFetch),
		);

		return () => {
			clearQuietTimer();
			clearMaxWaitTimer();
		};
	}, [conditions, prefetchPad, maxWaitMs, quietMs]);

	useLayoutEffect(() => {
		if (typeof document === "undefined") return;
		const onVisibleRefresh = (): void => {
			if (document.visibilityState !== "visible") return;
			const v = fetchViewportRef.current;
			const ad = adapterRef.current;
			const range: SyncRange = {
				kind: "predicate",
				conditions: ad.toConditions(v),
				sort: ad.sort,
				limit: predicateLimitRef.current,
			};
			if (canReconcileWithManifest()) {
				void bridgeRef.current
					.requestRangeReconcile(range)
					.then((rec) => {
						onRangeReconcileRef.current?.(rec);
					})
					.catch((err: unknown) => {
						console.error("partial sync viewport rangeReconcile failed", err);
					});
				return;
			}
			void bridgeRef.current.requestRangeQuery(range).catch((err: unknown) => {
				console.error("partial sync viewport rangeQuery failed", err);
			});
		};
		document.addEventListener("visibilitychange", onVisibleRefresh);
		return () => {
			document.removeEventListener("visibilitychange", onVisibleRefresh);
		};
	}, []);

	const totalCount =
		bridgeState.status === "partial" || bridgeState.status === "realtime"
			? bridgeState.totalCount
			: totalCountFallback;

	return { viewportRows, totalCount };
}
