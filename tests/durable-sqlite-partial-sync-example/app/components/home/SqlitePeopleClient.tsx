import {
	drizzleCollectionOptions,
	useDrizzleSqliteDb,
} from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import { createCollection } from "@tanstack/db";
import { useMemo } from "react";
import migrations from "../../../drizzle/migrations";
import * as schema from "../../../src/schema";
import { PeoplePartialSyncClient } from "./PeoplePartialSyncClient";
import type { WsTransport } from "./types";

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

	const collection = useMemo(
		() =>
			createCollection(
				drizzleCollectionOptions({
					drizzle,
					tableName: "peopleTable",
					readyPromise,
				}),
			),
		[drizzle, readyPromise],
	);

	return (
		<PeoplePartialSyncClient
			collection={collection as never}
			roomId={roomId}
			wsTransport={wsTransport}
			label="sqlite-wasm"
		/>
	);
}
