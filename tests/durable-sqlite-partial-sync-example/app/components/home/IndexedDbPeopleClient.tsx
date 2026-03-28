import { createPartialSyncedCollection } from "@firtoz/collection-sync";
import { keyvalCollectionOptions } from "@firtoz/idb-collections";
import { useMemo } from "react";
import { z } from "zod";
import { createIndexedDbAdapter } from "./indexeddb-adapter";
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

export function IndexedDbPeopleClient({ roomId, wsTransport }: Props) {
	const { collection, bridge, setTransportSend } = useMemo(() => {
		const { adapter, readyPromise } = createIndexedDbAdapter(roomId);
		return createPartialSyncedCollection(
			keyvalCollectionOptions({
				schema: personSchema,
				adapter,
				readyPromise,
				getKey: (item) => item.id,
			}),
			{ syncStateKey: `partial-sync-idb-people-${roomId}` },
		);
	}, [roomId]);

	return (
		<PeoplePartialSyncClient
			collection={collection}
			mutationBridge={bridge}
			setTransportSend={setTransportSend}
			roomId={roomId}
			wsTransport={wsTransport}
			label="indexeddb"
		/>
	);
}
