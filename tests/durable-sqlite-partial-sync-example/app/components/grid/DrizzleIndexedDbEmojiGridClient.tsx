import { createPartialSyncedCollection } from "@firtoz/collection-sync";
import { drizzleIndexedDBCollectionOptions } from "@firtoz/drizzle-indexeddb";
import type { IDBDatabaseLike } from "@firtoz/drizzle-indexeddb";
import { useEffect, useMemo, useRef, useState } from "react";
import * as emojiSchema from "../../../src/emoji-grid-schema";
import { openDrizzleEmojiGridIdb } from "../../drizzle-partial-sync-idb";
import { EmojiGridPartialSyncClient } from "./EmojiGridPartialSyncClient";
import type { WsTransport } from "../home/types";
import { EMOJI_GRID_PARTIAL_SYNC_COLLECTION_ID } from "./types";

type Props = {
	roomId: string;
	wsTransport: WsTransport;
};

export function DrizzleIndexedDbEmojiGridClient({
	roomId,
	wsTransport,
}: Props) {
	const indexedDBRef = useRef<IDBDatabaseLike | null>(null);
	const [idb, setIdb] = useState<IDBDatabaseLike | null>(null);

	useEffect(() => {
		let cancelled = false;
		let opened: IDBDatabaseLike | null = null;
		setIdb(null);
		indexedDBRef.current = null;
		void openDrizzleEmojiGridIdb(roomId).then((db) => {
			if (cancelled) {
				db.close();
				return;
			}
			opened = db;
			indexedDBRef.current = db;
			setIdb(db);
		});
		return () => {
			cancelled = true;
			opened?.close();
			indexedDBRef.current = null;
		};
	}, [roomId]);

	const synced = useMemo(() => {
		if (idb === null) return null;
		return createPartialSyncedCollection(
			drizzleIndexedDBCollectionOptions({
				indexedDBRef,
				table: emojiSchema.emojiGridTable,
				storeName: "emoji_grid",
				readyPromise: Promise.resolve(),
				deferLocalPersistence: true,
			}),
			{
				syncStateKey: `partial-sync-drizzle-idb-emoji-grid-${roomId}`,
				collectionId: EMOJI_GRID_PARTIAL_SYNC_COLLECTION_ID,
			},
		);
	}, [idb, roomId]);

	if (synced === null) {
		return (
			<div
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontFamily: "sans-serif",
				}}
			>
				<p>Opening Drizzle IndexedDB…</p>
			</div>
		);
	}

	return (
		<EmojiGridPartialSyncClient
			collection={synced.collection}
			mutationBridge={synced.bridge}
			setTransportSend={synced.setTransportSend}
			roomId={roomId}
			wsTransport={wsTransport}
			label="drizzle-idb"
		/>
	);
}
