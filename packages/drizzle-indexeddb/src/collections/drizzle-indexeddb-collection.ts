import type {
	Collection,
	CollectionConfig,
	InferSchemaInput,
	InferSchemaOutput,
	SyncMode,
} from "@tanstack/db";
import type { IR } from "@tanstack/db";
import { parseOrderByExpression } from "@tanstack/db";
import type { Table } from "drizzle-orm";

import {
	type IdOf,
	type SelectSchema,
	type InsertToSelectSchema,
	type TableWithRequiredFields,
	type BaseSyncConfig,
	type SyncBackend,
	createSyncFunction,
	createInsertSchemaWithDefaults,
	createGetKeyFunction,
	createCollectionConfig,
} from "@firtoz/drizzle-utils";
import { evaluateExpression, type CollectionUtils } from "@firtoz/db-helpers";
import { tryExtractIndexedQuery } from "@firtoz/idb-collections";

import type { IDBDatabaseLike } from "../idb-types";

// biome-ignore lint/suspicious/noExplicitAny: intentional
type AnyId = IdOf<any>;

/**
 * Type for items stored in IndexedDB (must have required sync fields)
 */
export type DrizzleIndexedDBSyncItem = {
	id: AnyId;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	[key: string]: unknown;
};

export interface DrizzleIndexedDBCollectionConfig<TTable extends Table> {
	/**
	 * Ref to the IndexedDB database instance
	 */
	indexedDBRef: React.RefObject<IDBDatabaseLike | null>;
	/**
	 * The Drizzle table definition (used for schema and type inference only)
	 */
	table: TTable;
	/**
	 * The name of the IndexedDB object store (should match the table name)
	 */
	storeName: string;
	/**
	 * Promise that resolves when the database is ready
	 */
	readyPromise: Promise<void>;
	/**
	 * Sync mode: 'eager' (immediate) or 'on-demand'
	 */
	syncMode?: SyncMode;
	/**
	 * Enable debug logging for index discovery and query optimization
	 */
	debug?: boolean;
	/**
	 * When set, local mutations confirm TanStack sync immediately and persist to IndexedDB on a
	 * coalesced timer (`createGenericSyncFunction` in `@firtoz/db-helpers`).
	 */
	deferLocalPersistence?: boolean | { flushIntervalMs?: number };
}

export type DrizzleIndexedDBCollectionConfigResult<TTable extends Table> = Omit<
	CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		IdOf<TTable>,
		InsertToSelectSchema<TTable>,
		CollectionUtils<InferSchemaOutput<SelectSchema<TTable>>>
	>,
	"utils"
> & {
	schema: InsertToSelectSchema<TTable>;
	utils: CollectionUtils<InferSchemaOutput<SelectSchema<TTable>>>;
};

export type DrizzleIndexedDBCollection<TTable extends TableWithRequiredFields> =
	Collection<
		InferSchemaOutput<SelectSchema<TTable>>,
		IdOf<TTable>,
		CollectionUtils<InferSchemaOutput<SelectSchema<TTable>>>,
		InsertToSelectSchema<TTable>,
		InferSchemaInput<InsertToSelectSchema<TTable>>
	>;

/**
 * Auto-discovers indexes from the IndexedDB store.
 * Returns a map of field names to index names for single-column indexes.
 */
function discoverIndexes(
	db: IDBDatabaseLike,
	storeName: string,
): Record<string, string> {
	const indexes = db.getStoreIndexes(storeName);
	const indexMap: Record<string, string> = {};

	for (const index of indexes) {
		if (typeof index.keyPath === "string") {
			indexMap[index.keyPath] = index.name;
		}
	}

	return indexMap;
}

/**
 * Creates a TanStack DB collection config for IndexedDB backed by Drizzle ORM.
 */
export function drizzleIndexedDBCollectionOptions<const TTable extends Table>(
	config: DrizzleIndexedDBCollectionConfig<TTable>,
): DrizzleIndexedDBCollectionConfigResult<TTable> {
	let discoveredIndexes: Record<string, string> = {};
	let indexesDiscovered = false;

	const table = config.table;

	const discoverIndexesOnce = async () => {
		await config.readyPromise;

		const db = config.indexedDBRef.current;
		if (!db) {
			throw new Error("Database not ready");
		}

		if (!indexesDiscovered) {
			discoveredIndexes = discoverIndexes(db, config.storeName);

			indexesDiscovered = true;
		}
	};

	const backend: SyncBackend<TTable> = {
		initialLoad: async () => {
			const db = config.indexedDBRef.current;
			if (!db) {
				throw new Error("Database not ready");
			}

			await discoverIndexesOnce();

			const items = await db.getAll<DrizzleIndexedDBSyncItem>(config.storeName);

			return items as unknown as InferSchemaOutput<SelectSchema<TTable>>[];
		},
		loadSubset: async (options) => {
			const db = config.indexedDBRef.current;
			if (!db) {
				throw new Error("Database not ready");
			}

			if (!indexesDiscovered) {
				discoveredIndexes = discoverIndexes(db, config.storeName);
				indexesDiscovered = true;
			}

			let items: DrizzleIndexedDBSyncItem[];

			let combinedWhere = options.where;
			if (options.cursor?.whereFrom) {
				if (combinedWhere) {
					combinedWhere = {
						type: "func",
						name: "and",
						args: [combinedWhere, options.cursor.whereFrom],
					} as IR.Func;
				} else {
					combinedWhere = options.cursor.whereFrom;
				}
			}

			const indexedQuery = combinedWhere
				? tryExtractIndexedQuery(combinedWhere, discoveredIndexes, config.debug)
				: null;

			if (indexedQuery) {
				items = await db.getAllByIndex<DrizzleIndexedDBSyncItem>(
					config.storeName,
					indexedQuery.indexName,
					indexedQuery.keyRange,
				);
			} else {
				items = await db.getAll<DrizzleIndexedDBSyncItem>(config.storeName);

				if (combinedWhere) {
					const whereExpression = combinedWhere;
					items = items.filter((item) =>
						evaluateExpression(
							whereExpression,
							item as Record<string, unknown>,
						),
					);
				}
			}

			if (options.orderBy) {
				const sorts = parseOrderByExpression(options.orderBy);
				items.sort((a, b) => {
					for (const sort of sorts) {
						// biome-ignore lint/suspicious/noExplicitAny: Need any for dynamic field access
						let aValue: any = a;
						// biome-ignore lint/suspicious/noExplicitAny: Need any for dynamic field access
						let bValue: any = b;
						for (const fieldName of sort.field) {
							aValue = aValue?.[fieldName];
							bValue = bValue?.[fieldName];
						}

						if (aValue < bValue) {
							return sort.direction === "asc" ? -1 : 1;
						}
						if (aValue > bValue) {
							return sort.direction === "asc" ? 1 : -1;
						}
					}
					return 0;
				});
			}

			if (options.offset !== undefined && options.offset > 0) {
				items = items.slice(options.offset);
			}

			if (options.limit !== undefined) {
				items = items.slice(0, options.limit);
			}

			return items as unknown as InferSchemaOutput<SelectSchema<TTable>>[];
		},

		handleInsert: async (itemsToInsert) => {
			const db = config.indexedDBRef.current;
			if (!db) {
				throw new Error("Database not ready");
			}

			await db.add(config.storeName, itemsToInsert);

			return itemsToInsert;
		},

		handleUpdate: async (mutations) => {
			const db = config.indexedDBRef.current;

			if (!db) {
				throw new Error("Database not ready");
			}

			const results: Array<InferSchemaOutput<SelectSchema<TTable>>> = [];
			const itemsToUpdate: DrizzleIndexedDBSyncItem[] = [];

			for (const mutation of mutations) {
				const existing = await db.get<DrizzleIndexedDBSyncItem>(
					config.storeName,
					mutation.key,
				);

				if (existing) {
					const updateTime = new Date();
					const updatedItem = {
						...existing,
						...mutation.changes,
						updatedAt: updateTime,
					} as DrizzleIndexedDBSyncItem;

					itemsToUpdate.push(updatedItem);
					results.push(
						updatedItem as unknown as InferSchemaOutput<SelectSchema<TTable>>,
					);
				} else {
					results.push(mutation.original);
				}
			}

			if (itemsToUpdate.length > 0) {
				await db.put(config.storeName, itemsToUpdate);
			}

			return results;
		},

		handleBatchPut: async (itemsToPut) => {
			const db = config.indexedDBRef.current;
			if (!db) {
				throw new Error("Database not ready");
			}
			const now = new Date();
			const rows = (itemsToPut as unknown as DrizzleIndexedDBSyncItem[]).map(
				(row) => ({
					...row,
					updatedAt: now,
				}),
			);
			await db.put(config.storeName, rows);
		},

		handleDelete: async (mutations) => {
			const db = config.indexedDBRef.current;

			if (!db) {
				throw new Error("Database not ready");
			}

			const keysToDelete: IDBValidKey[] = mutations.map((m) => m.key);

			await db.delete(config.storeName, keysToDelete);
		},

		handleTruncate: async () => {
			const db = config.indexedDBRef.current;

			if (!db) {
				throw new Error("Database not ready");
			}

			await db.clear(config.storeName);
		},
	};

	const wrappedBackend: SyncBackend<TTable> = {
		...backend,
		initialLoad: async () => {
			if (config.syncMode === "eager" || !config.syncMode) {
				return await backend.initialLoad();
			}

			await discoverIndexesOnce();

			return [];
		},
	};

	type TItem = InferSchemaOutput<SelectSchema<TTable>>;
	const getKey = createGetKeyFunction<TTable>();

	const baseSyncConfig: BaseSyncConfig<TTable> = {
		table,
		readyPromise: config.readyPromise,
		syncMode: config.syncMode,
		debug: config.debug,
		getSyncPersistKey: (item: TItem) => String(getKey(item)),
		...(config.deferLocalPersistence !== undefined
			? { deferLocalPersistence: config.deferLocalPersistence }
			: {}),
	};

	const syncResult = createSyncFunction(baseSyncConfig, wrappedBackend);

	const schema = createInsertSchemaWithDefaults(table);

	return createCollectionConfig({
		schema,
		getKey,
		syncResult,
		syncMode: config.syncMode,
	});
}
