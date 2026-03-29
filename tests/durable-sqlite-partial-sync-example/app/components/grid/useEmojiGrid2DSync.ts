import type {
	PartialSyncClientBridge,
	PartialSyncState,
	SyncClientBridge,
	SyncClientMessage,
} from "@firtoz/collection-sync";
import {
	betweenConditionsForNumericAxes,
	createPartialSyncAdapter,
	usePartialSyncCollection,
	usePartialSyncViewport,
} from "@firtoz/collection-sync/react";
import type { PartialSyncCollection } from "@firtoz/collection-sync/react";
import type { Collection } from "@tanstack/db";
import { useMemo } from "react";
import superjson from "superjson";
import {
	EMOJI_GRID_PARTIAL_SYNC_COLLECTION_ID,
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

export type UseEmojiGrid2DSyncOptions<TItem extends EmojiGridPartialSyncRow> = {
	collection: Collection<TItem> & PartialSyncCollection<TItem>;
	mutationBridge: SyncClientBridge<TItem>;
	setTransportSend: (send: (msg: SyncClientMessage) => void) => void;
	roomId: string;
	wsTransport: WsTransport;
	viewport: Viewport2D;
	/** Row ids kept visible in addition to the viewport predicate (e.g. active drag). */
	alwaysIncludeRowIds?: readonly string[];
	/** Defaults to `EMOJI_GRID_PARTIAL_SYNC_COLLECTION_ID` (must match the emoji grid DO). */
	collectionId?: string;
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
	alwaysIncludeRowIds,
	collectionId = EMOJI_GRID_PARTIAL_SYNC_COLLECTION_ID,
}: UseEmojiGrid2DSyncOptions<TItem>): UseEmojiGrid2DSyncResult<TItem> {
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

	const { bridge, bridgeState } = usePartialSyncCollection<TItem>({
		collection,
		mutationBridge,
		wsUrl,
		wsTransport,
		serializeJson: superjsonSerializeJson,
		deserializeJson: superjsonDeserializeJson,
		mergeTransportSend: setTransportSend,
		collectionId,
	});

	const adapter = useMemo(
		() =>
			createPartialSyncAdapter<TItem, Viewport2D, EmojiGridSortColumn>({
				toConditions: (v) =>
					betweenConditionsForNumericAxes(v, [
						{ column: "x", min: (w) => w.minX, max: (w) => w.maxX },
						{ column: "y", min: (w) => w.minY, max: (w) => w.maxY },
					]),
				expandViewport: (v, pad) => expandViewportForPrefetch(v, pad),
				sort: { column: "x", direction: "asc" },
				getSortValue: (row, col) => (col === "y" ? row.y : row.x),
			}),
		[],
	);

	const { viewportRows, totalCount } = usePartialSyncViewport({
		bridge,
		bridgeState,
		collection,
		adapter,
		viewport,
		predicateLimit: EMOJI_GRID_PREDICATE_LIMIT,
		prefetchPad: EMOJI_GRID_PREFETCH_UNITS,
		totalCountFallback: EMOJI_GRID_WORLD_SIZE,
		...(alwaysIncludeRowIds !== undefined && alwaysIncludeRowIds.length > 0
			? { alwaysIncludeRowIds }
			: {}),
	});

	return {
		bridge,
		bridgeState,
		viewportItems: viewportRows,
		totalCountForStatus: totalCount,
	};
}
