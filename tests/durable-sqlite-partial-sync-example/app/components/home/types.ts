import type { PartialSyncItem } from "@firtoz/collection-sync/react";
import type { DrizzleSqliteTableCollection } from "@firtoz/drizzle-utils";
import type { InferSelectModel } from "drizzle-orm";
import type * as schema from "../../../src/schema";

export type PeopleTable = typeof schema.peopleTable;
export type PersonRow = InferSelectModel<PeopleTable>;
export type PersonId = PersonRow["id"];

/** Row shape for partial-sync people UI (memory / keyval idb / drizzle idb). */
export type PeoplePartialSyncRow = PartialSyncItem & {
	name: string;
	age: number;
	createdAt: Date | number;
	deletedAt?: Date | number | null;
};

export type PeopleSqliteCollection = DrizzleSqliteTableCollection<PeopleTable>;

export const BACKEND_MODES = ["memory", "indexeddb", "drizzleIndexedDb"] as const;
export type BackendMode = (typeof BACKEND_MODES)[number];

export type WsTransport = "json" | "msgpack";

export { PEOPLE_PARTIAL_SYNC_COLLECTION_ID } from "../../../src/partial-sync-collection-ids";

export type SortState = {
	column: "name" | "age";
	direction: "asc" | "desc";
};
