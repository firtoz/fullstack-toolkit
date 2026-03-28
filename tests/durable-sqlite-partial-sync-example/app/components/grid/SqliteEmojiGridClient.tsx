import { createPartialSyncedCollection } from "@firtoz/collection-sync";
import {
	drizzleCollectionOptions,
	useDrizzleSqliteDb,
} from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import { useMemo } from "react";
import emojiMigrations from "../../../drizzle-emoji/migrations.js";
import * as emojiSchema from "../../../src/emoji-grid-schema";
import { EmojiGridPartialSyncClient } from "./EmojiGridPartialSyncClient";
import type { WsTransport } from "../home/types";
import { EMOJI_GRID_PARTIAL_SYNC_COLLECTION_ID } from "./types";

type Props = {
	roomId: string;
	wsTransport: WsTransport;
};

export function SqliteEmojiGridClient({ roomId, wsTransport }: Props) {
	const { drizzle, readyPromise } = useDrizzleSqliteDb(
		SqliteWorker,
		`partial-sync-emoji-${roomId}`,
		emojiSchema.emojiGridSchema,
		emojiMigrations,
	);

	const { collection, bridge, setTransportSend } = useMemo(
		() =>
			createPartialSyncedCollection(
				drizzleCollectionOptions({
					drizzle,
					tableName: "emojiGridTable",
					readyPromise,
				}),
				{
					syncStateKey: `partial-sync-sqlite-emoji-grid-${roomId}`,
					collectionId: EMOJI_GRID_PARTIAL_SYNC_COLLECTION_ID,
				},
			),
		[drizzle, readyPromise, roomId],
	);

	return (
		<EmojiGridPartialSyncClient
			collection={collection}
			mutationBridge={bridge}
			setTransportSend={setTransportSend}
			roomId={roomId}
			wsTransport={wsTransport}
			label="sqlite-wasm"
		/>
	);
}
