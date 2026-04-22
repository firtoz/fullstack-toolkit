import {
	createSyncedSqliteCollection,
	useDrizzleSqliteDb,
} from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { useMemo } from "react";
import migrations from "../../../drizzle/migrations";
import * as schema from "../../../src/schema";
import { TodoSyncClient, type WsTransport } from "./TodoSyncClient";

type Props = {
	roomId: string;
	showDeleted: boolean;
	wsTransport: WsTransport;
};

type InnerProps = Props & {
	drizzle: SqliteRemoteDatabase<typeof schema>;
	readyPromise: Promise<void>;
};

function SqliteTodoClientInner({
	roomId,
	showDeleted,
	wsTransport,
	drizzle,
	readyPromise,
}: InnerProps) {
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

export function SqliteTodoClient({ roomId, showDeleted, wsTransport }: Props) {
	const session = useDrizzleSqliteDb(
		SqliteWorker,
		`durable-sync-example-${roomId}`,
		schema,
		migrations,
	);
	const { drizzle, readyPromise, sessionStatus } = session;

	if (sessionStatus === "error") {
		return <div role="alert">{session.sessionError.message}</div>;
	}

	if (sessionStatus !== "ready") {
		return <p>Loading database…</p>;
	}

	return (
		<SqliteTodoClientInner
			roomId={roomId}
			showDeleted={showDeleted}
			wsTransport={wsTransport}
			drizzle={drizzle}
			readyPromise={readyPromise}
		/>
	);
}
