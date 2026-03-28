import { createSyncedCollection } from "@firtoz/collection-sync";
import { keyvalCollectionOptions } from "@firtoz/idb-collections";
import { useMemo } from "react";
import { z } from "zod";
import { createIndexedDbAdapter } from "./indexeddb-adapter";
import { TodoSyncClient, type WsTransport } from "./TodoSyncClient";
import type { TodoId } from "./types";

const todoSchema = z.object({
	id: z.custom<TodoId>((value) => typeof value === "string"),
	title: z.string(),
	completed: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
	deletedAt: z.date().nullable(),
});

type Props = {
	roomId: string;
	showDeleted: boolean;
	wsTransport: WsTransport;
};

export function IndexedDbTodoClient({
	roomId,
	showDeleted,
	wsTransport,
}: Props) {
	const { collection, bridge, setTransportSend } = useMemo(() => {
		const { adapter, readyPromise } = createIndexedDbAdapter(roomId);
		return createSyncedCollection(
			keyvalCollectionOptions({
				schema: todoSchema,
				adapter,
				readyPromise,
				getKey: (item) => item.id,
			}),
			{ syncStateKey: `durable-sync-indexeddb:${roomId}:${wsTransport}` },
		);
	}, [roomId, wsTransport]);

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
