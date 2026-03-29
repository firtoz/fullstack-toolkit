import type {
	SyncClientBridge,
	SyncClientMessage,
} from "@firtoz/collection-sync";
import type { PartialSyncCollection } from "@firtoz/collection-sync/react";
import type { Collection } from "@tanstack/db";
import { useState } from "react";
import type { WsTransport } from "../home/types";
import { EmojiGrid2D } from "./EmojiGrid2D";
import {
	clampViewportToWorld,
	EMOJI_GRID_VIEWPORT_UNITS,
	EMOJI_GRID_WORLD_SIZE,
	type EmojiGridPartialSyncRow,
	type Viewport2D,
} from "./types";
import { useEmojiGrid2DSync } from "./useEmojiGrid2DSync";

type Props<TItem extends EmojiGridPartialSyncRow> = {
	collection: Collection<TItem> & PartialSyncCollection<TItem>;
	mutationBridge: SyncClientBridge<TItem>;
	setTransportSend: (send: (msg: SyncClientMessage) => void) => void;
	roomId: string;
	wsTransport: WsTransport;
	label: string;
};

function initialViewport(): Viewport2D {
	const max = EMOJI_GRID_WORLD_SIZE - 1;
	const span = Math.min(EMOJI_GRID_VIEWPORT_UNITS - 1, max);
	return clampViewportToWorld({
		minX: 0,
		maxX: span,
		minY: 0,
		maxY: span,
	});
}

export function EmojiGridPartialSyncClient<
	TItem extends EmojiGridPartialSyncRow,
>({
	collection,
	mutationBridge,
	setTransportSend,
	roomId,
	wsTransport,
	label,
}: Props<TItem>) {
	const [viewport, setViewport] = useState<Viewport2D>(initialViewport);
	const [alwaysIncludeRowIds, setAlwaysIncludeRowIds] = useState<
		readonly string[]
	>([]);

	const {
		bridge: partialBridge,
		bridgeState,
		viewportItems,
		totalCountForStatus,
	} = useEmojiGrid2DSync({
		collection,
		mutationBridge,
		setTransportSend,
		roomId,
		wsTransport,
		viewport,
		alwaysIncludeRowIds,
	});

	return (
		<div style={{ position: "absolute", inset: 0 }}>
			<EmojiGrid2D<TItem>
				collection={collection}
				roomId={roomId}
				label={label}
				viewport={viewport}
				onViewportChange={setViewport}
				viewportItems={viewportItems}
				partialBridge={partialBridge}
				bridgeState={bridgeState}
				totalCountForStatus={totalCountForStatus}
				onAlwaysIncludeRowIdsChange={setAlwaysIncludeRowIds}
			/>
		</div>
	);
}
