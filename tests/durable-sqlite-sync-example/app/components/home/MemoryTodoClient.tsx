import { createSyncedCollection } from "@firtoz/collection-sync";
import { memoryCollectionOptions } from "@firtoz/db-helpers";
import { useMemo } from "react";
import { z } from "zod";
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

export function MemoryTodoClient({ roomId, showDeleted, wsTransport }: Props) {
	const { collection, bridge, setTransportSend } = useMemo(
		() =>
			createSyncedCollection(
				memoryCollectionOptions({
					id: `sync-example-memory-${roomId}`,
					schema: todoSchema,
					getKey: (item) => item.id,
				}),
				// No syncStateKey: memory is wiped on refresh but localStorage would
				// keep lastAckedServerVersion, so syncHello would skip the full snapshot
				// and the UI would be empty or partially wrong until the log wraps.
			),
		[roomId],
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
