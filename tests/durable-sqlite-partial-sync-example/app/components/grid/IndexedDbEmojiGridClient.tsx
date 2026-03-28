import { createPartialSyncedCollection } from "@firtoz/collection-sync";
import { keyvalCollectionOptions } from "@firtoz/idb-collections";
import { useMemo } from "react";
import { emojiGridRowSchema } from "./emoji-grid-row-schema";
import { EmojiGridPartialSyncClient } from "./EmojiGridPartialSyncClient";
import { createEmojiGridIndexedDbAdapter } from "./indexeddb-emoji-adapter";
import type { WsTransport } from "../home/types";
import { EMOJI_GRID_PARTIAL_SYNC_COLLECTION_ID } from "./types";

type Props = {
	roomId: string;
	wsTransport: WsTransport;
};

export function IndexedDbEmojiGridClient({ roomId, wsTransport }: Props) {
	const { collection, bridge, setTransportSend } = useMemo(() => {
		const { adapter, readyPromise } = createEmojiGridIndexedDbAdapter(roomId);
		return createPartialSyncedCollection(
			keyvalCollectionOptions({
				schema: emojiGridRowSchema,
				adapter,
				readyPromise,
				getKey: (item) => item.id,
			}),
			{
				syncStateKey: `partial-sync-idb-emoji-grid-${roomId}`,
				collectionId: EMOJI_GRID_PARTIAL_SYNC_COLLECTION_ID,
			},
		);
	}, [roomId]);

	return (
		<EmojiGridPartialSyncClient
			collection={collection}
			mutationBridge={bridge}
			setTransportSend={setTransportSend}
			roomId={roomId}
			wsTransport={wsTransport}
			label="indexeddb"
		/>
	);
}
