import { createPartialSyncedCollection } from "@firtoz/collection-sync";
import { drizzleIndexedDBCollectionOptions } from "@firtoz/drizzle-indexeddb";
import type { IDBDatabaseLike } from "@firtoz/drizzle-indexeddb";
import { useEffect, useMemo, useRef, useState } from "react";
import * as schema from "../../../src/schema";
import { openDrizzlePeoplePartialSyncIdb } from "../../drizzle-partial-sync-idb";
import { PeoplePartialSyncClient } from "./PeoplePartialSyncClient";
import { PEOPLE_PARTIAL_SYNC_COLLECTION_ID, type WsTransport } from "./types";

type Props = {
	roomId: string;
	wsTransport: WsTransport;
};

export function DrizzleIndexedDbPeopleClient({ roomId, wsTransport }: Props) {
	const indexedDBRef = useRef<IDBDatabaseLike | null>(null);
	const [idb, setIdb] = useState<IDBDatabaseLike | null>(null);

	useEffect(() => {
		let cancelled = false;
		let opened: IDBDatabaseLike | null = null;
		setIdb(null);
		indexedDBRef.current = null;
		void openDrizzlePeoplePartialSyncIdb(roomId).then((db) => {
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
				table: schema.peopleTable,
				storeName: "people",
				readyPromise: Promise.resolve(),
			}),
			{
				syncStateKey: `partial-sync-drizzle-idb-people-${roomId}`,
				collectionId: PEOPLE_PARTIAL_SYNC_COLLECTION_ID,
			},
		);
	}, [idb, roomId]);

	if (synced === null) {
		return <p style={{ marginTop: 16 }}>Opening Drizzle IndexedDB…</p>;
	}

	return (
		<PeoplePartialSyncClient
			collection={synced.collection}
			mutationBridge={synced.bridge}
			setTransportSend={synced.setTransportSend}
			roomId={roomId}
			wsTransport={wsTransport}
			label="drizzle-idb"
		/>
	);
}
