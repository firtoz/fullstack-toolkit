import { memoryCollectionOptions } from "@firtoz/db-helpers";
import { createCollection } from "@tanstack/db";
import { useMemo } from "react";
import { z } from "zod";
import { PeoplePartialSyncClient } from "./PeoplePartialSyncClient";
import type { PersonId, WsTransport } from "./types";

const personSchema = z.object({
	id: z.custom<PersonId>((value) => typeof value === "string"),
	name: z.string(),
	age: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
	deletedAt: z.date().nullable(),
});

type Props = {
	roomId: string;
	wsTransport: WsTransport;
};

export function MemoryPeopleClient({ roomId, wsTransport }: Props) {
	const collection = useMemo(
		() =>
			createCollection(
				memoryCollectionOptions({
					id: `partial-sync-memory-${roomId}`,
					schema: personSchema,
					getKey: (item) => item.id,
				}),
			),
		[roomId],
	);

	return (
		<PeoplePartialSyncClient
			collection={collection}
			roomId={roomId}
			wsTransport={wsTransport}
			label="memory"
		/>
	);
}
