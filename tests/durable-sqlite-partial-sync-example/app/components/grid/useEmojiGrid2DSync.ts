import type {
	SyncClientBridge,
	SyncClientMessage,
} from "@firtoz/collection-sync";
import {
	connectPartialSync,
	PartialSyncClientBridge,
	type PartialSyncState,
	type RangeCondition,
} from "@firtoz/collection-sync";
import type { PartialSyncCollection } from "@firtoz/collection-sync/react";
import {
	assertSyncUtils,
	usePredicateFilteredRows,
} from "@firtoz/collection-sync/react";
import type { Collection } from "@tanstack/db";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import superjson from "superjson";
import {
	EMOJI_GRID_PREDICATE_LIMIT,
	EMOJI_GRID_PREFETCH_UNITS,
	EMOJI_GRID_WORLD_SIZE,
	expandViewportForPrefetch,
	type EmojiGridPartialSyncRow,
	type EmojiGridSortColumn,
	type Viewport2D,
	type WsTransport,
} from "./types";

const superjsonSerializeJson = (value: unknown): string =>
	superjson.stringify(value);
const superjsonDeserializeJson = (raw: string): unknown => superjson.parse(raw);

/**
 * Viewport range-query scheduling: respond ASAP when the viewport has been
 * stable, but coalesce rapid scroll/resize bursts. During continuous motion,
 * still fetch at least every VIEWPORT_RANGE_MAX_WAIT_MS after the previous fetch.
 * Mutations and other sync paths stay immediate (this only gates range queries).
 */
const VIEWPORT_RANGE_QUIET_MS = 72;
const VIEWPORT_RANGE_MAX_WAIT_MS = 200;

export type UseEmojiGrid2DSyncOptions<TItem extends EmojiGridPartialSyncRow> = {
	collection: Collection<TItem> & PartialSyncCollection<TItem>;
	mutationBridge: SyncClientBridge<TItem>;
	setTransportSend: (send: (msg: SyncClientMessage) => void) => void;
	roomId: string;
	wsTransport: WsTransport;
	viewport: Viewport2D;
};

export type UseEmojiGrid2DSyncResult<TItem extends EmojiGridPartialSyncRow> = {
	bridge: PartialSyncClientBridge<TItem>;
	bridgeState: PartialSyncState;
	viewportItems: TItem[];
	totalCountForStatus: number;
};

export function useEmojiGrid2DSync<TItem extends EmojiGridPartialSyncRow>({
	collection,
	mutationBridge,
	setTransportSend,
	roomId,
	wsTransport,
	viewport,
}: UseEmojiGrid2DSyncOptions<TItem>): UseEmojiGrid2DSyncResult<TItem> {
	const [bridgeState, setBridgeState] = useState<PartialSyncState>({
		status: "offline",
	});

	const wsUrl = useMemo(() => {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const url = new URL(
			`${protocol}//${window.location.host}/grid/${roomId}/websocket`,
		);
		if (wsTransport === "msgpack") {
			url.searchParams.set("transport", "msgpack");
		}
		return url.toString();
	}, [roomId, wsTransport]);

	const syncUtils = useMemo(
		() => assertSyncUtils<TItem>(collection.utils),
		[collection],
	);
	const syncUtilsRef = useRef(syncUtils);
	syncUtilsRef.current = syncUtils;

	const partialClientId = mutationBridge.clientId;

	const bridge = useMemo(
		() =>
			new PartialSyncClientBridge<TItem>({
				clientId: partialClientId,
				collection: {
					utils: {
						receiveSync: (messages) =>
							syncUtilsRef.current.receiveSync(messages),
					},
				},
				send: () => {},
				onStateChange: (state) => {
					setBridgeState(state);
				},
			}),
		[partialClientId],
	);

	const serializeJsonRef = useRef(superjsonSerializeJson);
	const deserializeJsonRef = useRef(superjsonDeserializeJson);
	const mutationBridgeRef = useRef(mutationBridge);
	mutationBridgeRef.current = mutationBridge;
	const mergeTransportSendRef = useRef(setTransportSend);
	mergeTransportSendRef.current = setTransportSend;

	useLayoutEffect(() => {
		const disconnect = connectPartialSync(bridge, {
			url: wsUrl,
			transport: wsTransport,
			setTransportSend: (send) => {
				bridge.setSend(send);
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

	const conditions: RangeCondition[] = useMemo(
		() => [
			{
				column: "x",
				op: "between",
				value: viewport.minX,
				valueTo: viewport.maxX,
			},
			{
				column: "y",
				op: "between",
				value: viewport.minY,
				valueTo: viewport.maxY,
			},
		],
		[viewport.minX, viewport.maxX, viewport.minY, viewport.maxY],
	);

	const getSortValue = useCallback(
		(row: TItem, column: EmojiGridSortColumn): unknown =>
			column === "y" ? row.y : row.x,
		[],
	);

	const viewportItems = usePredicateFilteredRows<TItem, EmojiGridSortColumn>({
		collection,
		conditions,
		sort: { column: "x", direction: "asc" },
		getSortValue,
		limit: EMOJI_GRID_PREDICATE_LIMIT,
	});

	const fetchViewport = useMemo(
		() => expandViewportForPrefetch(viewport, EMOJI_GRID_PREFETCH_UNITS),
		[viewport],
	);

	const bridgeRef = useRef(bridge);
	bridgeRef.current = bridge;
	const fetchViewportRef = useRef(fetchViewport);
	fetchViewportRef.current = fetchViewport;

	const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastRangeFetchAtRef = useRef(0);

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
			void bridgeRef.current
				.requestRangeQuery({
					kind: "predicate",
					conditions: [
						{
							column: "x",
							op: "between",
							value: v.minX,
							valueTo: v.maxX,
						},
						{
							column: "y",
							op: "between",
							value: v.minY,
							valueTo: v.maxY,
						},
					],
					sort: { column: "x", direction: "asc" },
					limit: EMOJI_GRID_PREDICATE_LIMIT,
				})
				.catch((err: unknown) => {
					console.error("emoji grid range query failed", err);
				});
		};

		clearQuietTimer();
		clearMaxWaitTimer();

		const now = performance.now();
		const sinceLastFetch = now - lastRangeFetchAtRef.current;
		const fetchImmediately =
			lastRangeFetchAtRef.current === 0 ||
			sinceLastFetch >= VIEWPORT_RANGE_MAX_WAIT_MS;

		if (fetchImmediately) {
			runRangeQuery();
			return () => {
				clearQuietTimer();
				clearMaxWaitTimer();
			};
		}

		quietTimerRef.current = setTimeout(runRangeQuery, VIEWPORT_RANGE_QUIET_MS);
		maxWaitTimerRef.current = setTimeout(
			runRangeQuery,
			Math.max(0, VIEWPORT_RANGE_MAX_WAIT_MS - sinceLastFetch),
		);

		return () => {
			clearQuietTimer();
			clearMaxWaitTimer();
		};
	}, [bridge, fetchViewport]);

	const totalCountForStatus =
		bridgeState.status === "partial" || bridgeState.status === "realtime"
			? bridgeState.totalCount
			: EMOJI_GRID_WORLD_SIZE;

	return {
		bridge,
		bridgeState,
		viewportItems,
		totalCountForStatus,
	};
}
