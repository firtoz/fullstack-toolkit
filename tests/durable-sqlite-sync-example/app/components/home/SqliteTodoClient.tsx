import { createSyncedSqliteCollection, useDrizzleSqliteDb } from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import { useMemo } from "react";
import migrations from "../../../drizzle/migrations";
import * as schema from "../../../src/schema";
import { TodoSyncClient, type WsTransport } from "./TodoSyncClient";

type Props = {
	roomId: string;
	showDeleted: boolean;
	wsTransport: WsTransport;
};

export function SqliteTodoClient({ roomId, showDeleted, wsTransport }: Props) {
	const { drizzle, readyPromise } = useDrizzleSqliteDb(
		SqliteWorker,
		`durable-sync-example-${roomId}`,
		schema,
		migrations,
	);

	const { collection, bridge, setTransportSend } = useMemo(
		() =>
			createSyncedSqliteCollection(
				{
					drizzle,
					tableName: "todosTable",
					readyPromise,
				},
				{
					syncStateKey: `durable-sync-sqlite:${roomId}:${wsTransport}`,
				},
			),
		[drizzle, readyPromise, roomId, wsTransport],
	);

	return (
		<TodoSyncClient
			collection={collection}
			bridge={bridge}
			setTransportSend={setTransportSend}
			roomId={roomId}
			showDeleted={showDeleted}
			wsTransport={wsTransport}
		/>
	);
}
