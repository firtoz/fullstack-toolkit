import {
	createCollection,
	type Collection,
	type InferSchemaInput,
	type InferSchemaOutput,
	type SyncMode,
	type Transaction,
	type WritableDeep,
} from "@tanstack/db";
import type { Table } from "drizzle-orm";
import type {
	IdOf,
	InsertSchema,
	SelectSchema,
	CollectionUtils,
} from "@firtoz/drizzle-utils";
import {
	indexedDBCollectionOptions,
	type IndexedDBCollectionConfig,
} from "./collections/indexeddb-collection";
import {
	migrateIndexedDBWithFunctions,
	type Migration,
} from "./function-migrator";
import { openIndexedDb } from "./idb-operations";
import type { IDBCreator, IDBDatabaseLike } from "./idb-types";

/**
 * Configuration for creating a standalone IndexedDB collection
 */
export interface StandaloneCollectionConfig<TTable extends Table> {
	/**
	 * Name of the IndexedDB database
	 */
	dbName: string;
	/**
	 * The Drizzle table definition
	 */
	table: TTable;
	/**
	 * The name of the IndexedDB object store (defaults to table name)
	 */
	storeName?: string;
	/**
	 * Migrations to apply (optional)
	 */
	migrations?: Migration[];
	/**
	 * Custom database creator (for testing/mocking)
	 */
	dbCreator?: IDBCreator;
	/**
	 * Enable debug logging
	 */
	debug?: boolean;
	/**
	 * Sync mode: 'eager' (immediate) or 'lazy' (on-demand)
	 */
	syncMode?: SyncMode;
}

/**
 * Type for the underlying collection
 */
type InternalCollection<TTable extends Table> = Collection<
	InferSchemaOutput<SelectSchema<TTable>>,
	IdOf<TTable>,
	CollectionUtils<InferSchemaOutput<SelectSchema<TTable>>>,
	SelectSchema<TTable>,
	InferSchemaInput<InsertSchema<TTable>>
>;

/**
 * Transaction type for mutations
 */
type MutationTransaction<TTable extends Table> = Transaction<
	InferSchemaOutput<SelectSchema<TTable>>
>;

/**
 * Insert input type (what you pass to insert)
 */
type InsertInput<TTable extends Table> = InferSchemaInput<InsertSchema<TTable>>;

/**
 * Item type (what you get back from getAll, etc.)
 */
type ItemType<TTable extends Table> = InferSchemaOutput<SelectSchema<TTable>>;

/**
 * Writable draft type for update callbacks
 */
type DraftType<TTable extends Table> = WritableDeep<InsertInput<TTable>>;

/**
 * Standalone IndexedDB collection API
 */
export interface StandaloneCollection<TTable extends Table> {
	/**
	 * Promise that resolves when the collection is ready
	 */
	ready: Promise<void>;

	/**
	 * Check if the collection is ready (sync)
	 */
	isReady(): boolean;

	/**
	 * Get all items (sync - returns current state)
	 */
	getAll(): ItemType<TTable>[];

	/**
	 * Get an item by key (sync)
	 */
	get(key: IdOf<TTable>): ItemType<TTable> | undefined;

	/**
	 * Insert item(s)
	 * @returns Promise that resolves when persisted
	 */
	insert(
		data: InsertInput<TTable> | InsertInput<TTable>[],
		callback?: (transaction: MutationTransaction<TTable>) => void,
	): Promise<MutationTransaction<TTable>>;

	/**
	 * Update an item by key using a callback that receives a draft
	 * @returns Promise that resolves when persisted
	 */
	update(
		key: IdOf<TTable>,
		updater: (draft: DraftType<TTable>) => void,
		callback?: (transaction: MutationTransaction<TTable>) => void,
	): Promise<MutationTransaction<TTable>>;

	/**
	 * Delete item(s) by key
	 * @returns Promise that resolves when persisted
	 */
	delete(
		key: IdOf<TTable> | IdOf<TTable>[],
		callback?: (transaction: MutationTransaction<TTable>) => void,
	): Promise<MutationTransaction<TTable>>;

	/**
	 * Clear all items from the store
	 * @returns Promise that resolves when truncate is complete
	 */
	truncate(): Promise<void>;

	/**
	 * Access to collection utils (truncate, pushExternalSync)
	 */
	utils: CollectionUtils<ItemType<TTable>>;

	/**
	 * The underlying TanStack DB collection (for advanced usage)
	 */
	collection: InternalCollection<TTable>;

	/**
	 * The IndexedDB database instance (available after ready)
	 */
	db: IDBDatabaseLike | null;

	/**
	 * Close the database connection
	 */
	close(): void;
}

/**
 * Create a standalone IndexedDB collection for use outside of React.
 *
 * @example
 * ```ts
 * const db = await createStandaloneCollection({
 *   dbName: "myapp.db",
 *   table: schema.todos,
 *   migrations,
 * });
 *
 * // Wait for ready
 * await db.ready;
 *
 * // Get all items
 * const items = db.getAll();
 *
 * // Insert
 * await db.insert({ title: "New todo" });
 *
 * // Update
 * await db.update(itemId, { title: "Updated" });
 *
 * // Delete
 * await db.delete(itemId);
 *
 * // Truncate
 * await db.truncate();
 *
 * // Clean up
 * db.close();
 * ```
 */
export function createStandaloneCollection<TTable extends Table>(
	config: StandaloneCollectionConfig<TTable>,
): StandaloneCollection<TTable> {
	const {
		dbName,
		table,
		storeName = (table as unknown as { _: { name: string } })._.name,
		migrations = [],
		dbCreator,
		debug = false,
		syncMode = "eager",
	} = config;

	// Create ready promise
	let resolveReady: () => void;
	const readyPromise = new Promise<void>((resolve) => {
		resolveReady = resolve;
	});

	// Database ref
	const indexedDBRef: { current: IDBDatabaseLike | null } = { current: null };

	// Initialize database
	const initDB = async () => {
		try {
			if (migrations.length === 0) {
				if (debug) {
					console.log(
						`[StandaloneCollection] Opening database "${dbName}" directly`,
					);
				}
				indexedDBRef.current = await openIndexedDb(dbName, dbCreator);
			} else {
				if (debug) {
					console.log(`[StandaloneCollection] Migrating database "${dbName}"`);
				}
				indexedDBRef.current = await migrateIndexedDBWithFunctions(
					dbName,
					migrations,
					debug,
					dbCreator,
				);
			}

			if (debug) {
				console.log(`[StandaloneCollection] Database "${dbName}" initialized`);
			}

			resolveReady();
		} catch (error) {
			console.error(
				`[StandaloneCollection] Failed to initialize database "${dbName}":`,
				error,
			);
			throw error;
		}
	};

	// Start initialization
	initDB();

	// Create collection config
	const collectionConfig = indexedDBCollectionOptions({
		indexedDBRef,
		table,
		storeName,
		readyPromise,
		debug,
		syncMode,
	} as IndexedDBCollectionConfig<TTable>);

	// Create the collection
	const collection = createCollection(
		collectionConfig,
	) as unknown as InternalCollection<TTable>;

	// Wait for collection to be ready
	const collectionReady = new Promise<void>((resolve) => {
		if (collection.isReady()) {
			resolve();
			return;
		}
		collection.preload();
		collection.onFirstReady(() => resolve());
	});

	// Combined ready promise
	const ready = Promise.all([readyPromise, collectionReady]).then(() => {});

	// Helper to wait for transaction to persist
	const waitForPersist = async (
		transaction: MutationTransaction<TTable>,
		callback?: (transaction: MutationTransaction<TTable>) => void,
	): Promise<MutationTransaction<TTable>> => {
		if (callback) {
			callback(transaction);
		}
		await transaction.isPersisted.promise;
		return transaction;
	};

	return {
		ready,

		isReady(): boolean {
			return collection.isReady();
		},

		getAll(): ItemType<TTable>[] {
			return collection.toArray;
		},

		get(key: IdOf<TTable>): ItemType<TTable> | undefined {
			return collection.state.get(key);
		},

		insert(
			data: InsertInput<TTable> | InsertInput<TTable>[],
			callback?: (transaction: MutationTransaction<TTable>) => void,
		): Promise<MutationTransaction<TTable>> {
			const items = (Array.isArray(data) ? data : [data]) as InferSchemaOutput<
				SelectSchema<TTable>
			>;
			const transaction = collection.insert(
				items,
			) as MutationTransaction<TTable>;
			return waitForPersist(transaction, callback);
		},

		update(
			key: IdOf<TTable>,
			updater: (draft: DraftType<TTable>) => void,
			callback?: (transaction: MutationTransaction<TTable>) => void,
		): Promise<MutationTransaction<TTable>> {
			const transaction = collection.update(
				key,
				updater,
			) as MutationTransaction<TTable>;
			return waitForPersist(transaction, callback);
		},

		delete(
			key: IdOf<TTable> | IdOf<TTable>[],
			callback?: (transaction: MutationTransaction<TTable>) => void,
		): Promise<MutationTransaction<TTable>> {
			const keys = Array.isArray(key) ? key : [key];
			const transaction = collection.delete(keys);
			return waitForPersist(transaction, callback);
		},

		truncate(): Promise<void> {
			return collection.utils.truncate();
		},

		utils: collection.utils,

		collection,

		get db(): IDBDatabaseLike | null {
			return indexedDBRef.current;
		},

		close(): void {
			indexedDBRef.current?.close();
			indexedDBRef.current = null;
		},
	};
}
