import { createPartialSyncedCollection } from "@firtoz/collection-sync";
import {
	drizzleCollectionOptions,
	useDrizzleSqliteDb,
} from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import { useMemo } from "react";
import migrations from "../../../drizzle/migrations";
import * as schema from "../../../src/schema";
import { PeoplePartialSyncClient } from "./PeoplePartialSyncClient";
import { PEOPLE_PARTIAL_SYNC_COLLECTION_ID, type WsTransport } from "./types";

type Props = {
	roomId: string;
	wsTransport: WsTransport;
};

export function SqlitePeopleClient({ roomId, wsTransport }: Props) {
	const { drizzle, readyPromise } = useDrizzleSqliteDb(
		SqliteWorker,
		`partial-sync-example-${roomId}`,
		schema,
		migrations,
	);

	const { collection, bridge, setTransportSend } = useMemo(
		() =>
			createPartialSyncedCollection(
				drizzleCollectionOptions({
					drizzle,
					tableName: "peopleTable",
					readyPromise,
				}),
				{
					syncStateKey: `partial-sync-sqlite-people-${roomId}`,
					collectionId: PEOPLE_PARTIAL_SYNC_COLLECTION_ID,
				},
			),
		[drizzle, readyPromise, roomId],
	);

	return (
		<PeoplePartialSyncClient
			collection={collection}
			mutationBridge={bridge}
			setTransportSend={setTransportSend}
			roomId={roomId}
			wsTransport={wsTransport}
			label="sqlite-wasm"
		/>
	);
}
