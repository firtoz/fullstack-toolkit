import type { DrizzleSqliteTableCollection } from "@firtoz/drizzle-utils";
import type { InferSelectModel } from "drizzle-orm";
import type * as schema from "../../../src/schema";

export type PeopleTable = typeof schema.peopleTable;
export type PersonRow = InferSelectModel<PeopleTable>;
export type PersonId = PersonRow["id"];
export type PeopleSqliteCollection = DrizzleSqliteTableCollection<PeopleTable>;

export const BACKEND_MODES = ["memory", "indexeddb", "sqlite"] as const;
export type BackendMode = (typeof BACKEND_MODES)[number];

export type WsTransport = "json" | "msgpack";

export type SortState = {
	column: "name" | "age";
	direction: "asc" | "desc";
};

/**
 * Structural type so memory / IndexedDB / Drizzle TanStack collections can all be passed to
 * {@link PeoplePartialSyncClient} without fighting `Collection` generic variance.
 */
export type PeoplePartialSyncCollection = {
	/** Backend row shapes differ slightly (e.g. Drizzle `id` typing); narrow at use sites. */
	get(key: string | number): unknown;
	subscribeChanges(
		callback: (changes: unknown[]) => void,
		options?: { includeInitialState?: boolean },
	): { unsubscribe: () => void };
	entries(): IterableIterator<[string | number, unknown]>;
	/** Memory / keyval / Drizzle helpers attach `receiveSync` and `truncate` here. */
	utils: object;
};
