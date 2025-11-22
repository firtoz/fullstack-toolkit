import type { InferSchemaOutput, SyncMode } from "@tanstack/db";
import type { IR } from "@tanstack/db";
import { extractSimpleComparisons, parseOrderByExpression } from "@tanstack/db";
import type { Table } from "drizzle-orm";

import {
	type IdOf,
	type SelectSchema,
	type BaseSyncConfig,
	type SyncBackend,
	createSyncFunction,
	createInsertSchemaWithDefaults,
	createGetKeyFunction,
	createCollectionConfig,
} from "@firtoz/drizzle-utils";

// biome-ignore lint/suspicious/noExplicitAny: intentional
type AnyId = IdOf<any>;

/**
 * Type for items stored in IndexedDB (must have required sync fields)
 */
export type IndexedDBSyncItem = {
	id: AnyId;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	[key: string]: unknown;
};

export interface IndexedDBCollectionConfig<TTable extends Table> {
	/**
	 * Ref to the IndexedDB database instance
	 */
	indexedDBRef: React.RefObject<IDBDatabase | null>;
	/**
	 * The database name (for perf markers)
	 */
	dbName: string;
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
	 * Sync mode: 'eager' (immediate) or 'lazy' (on-demand)
	 */
	syncMode?: SyncMode;
	/**
	 * Enable debug logging for index discovery and query optimization
	 */
	debug?: boolean;
}

/**
 * Evaluates a TanStack DB IR expression against an IndexedDB item
 */
function evaluateExpression(
	expression: IR.BasicExpression,
	item: Record<string, unknown>,
): boolean {
	if (expression.type === "ref") {
		const propRef = expression as IR.PropRef;
		const columnName = propRef.path[propRef.path.length - 1];
		return item[columnName as string] !== undefined;
	}

	if (expression.type === "val") {
		const value = expression as IR.Value;
		return !!value.value;
	}

	if (expression.type === "func") {
		const func = expression as IR.Func;

		switch (func.name) {
			case "eq": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				return left === right;
			}
			case "ne": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				return left !== right;
			}
			case "gt": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				return left > right;
			}
			case "gte": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				return left >= right;
			}
			case "lt": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				return left < right;
			}
			case "lte": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				return left <= right;
			}
			case "and": {
				return func.args.every((arg) => evaluateExpression(arg, item));
			}
			case "or": {
				return func.args.some((arg) => evaluateExpression(arg, item));
			}
			case "not": {
				return !evaluateExpression(func.args[0], item);
			}
			case "isNull": {
				const value = getExpressionValue(func.args[0], item);
				return value === null || value === undefined;
			}
			case "isNotNull": {
				const value = getExpressionValue(func.args[0], item);
				return value !== null && value !== undefined;
			}
			case "like": {
				const left = String(getExpressionValue(func.args[0], item));
				const right = String(getExpressionValue(func.args[1], item));
				// Convert SQL LIKE pattern to regex (case-sensitive)
				const pattern = right.replace(/%/g, ".*").replace(/_/g, ".");
				return new RegExp(`^${pattern}$`).test(left);
			}
			case "ilike": {
				const left = String(getExpressionValue(func.args[0], item));
				const right = String(getExpressionValue(func.args[1], item));
				// Convert SQL ILIKE pattern to regex (case-insensitive)
				const pattern = right.replace(/%/g, ".*").replace(/_/g, ".");
				return new RegExp(`^${pattern}$`, "i").test(left);
			}
			case "in": {
				const left = getExpressionValue(func.args[0], item);
				const right = getExpressionValue(func.args[1], item);
				// Check if left value is in the right array
				return Array.isArray(right) && right.includes(left);
			}
			case "isUndefined": {
				const value = getExpressionValue(func.args[0], item);
				return value === null || value === undefined;
			}
			default:
				throw new Error(`Unsupported function: ${func.name}`);
		}
	}

	throw new Error(
		`Unsupported expression type: ${(expression as { type: string }).type}`,
	);
}

/**
 * Gets the value from an IR expression
 */
function getExpressionValue(
	expression: IR.BasicExpression,
	item: Record<string, unknown>,
	// biome-ignore lint/suspicious/noExplicitAny: We need any here for dynamic values
): any {
	if (expression.type === "ref") {
		const propRef = expression as IR.PropRef;
		const columnName = propRef.path[propRef.path.length - 1];
		return item[columnName as string];
	}

	if (expression.type === "val") {
		const value = expression as IR.Value;
		return value.value;
	}

	throw new Error(`Cannot get value from expression type: ${expression.type}`);
}

/**
 * Reads all items from an IndexedDB object store
 */
function getAllFromStore(
	db: IDBDatabase,
	storeName: string,
): Promise<IndexedDBSyncItem[]> {
	return new Promise((resolve, reject) => {
		if (!db.objectStoreNames.contains(storeName)) {
			resolve([]);
			return;
		}

		const transaction = db.transaction(storeName, "readonly");

		const store = transaction.objectStore(storeName);

		const request = store.getAll();

		request.onsuccess = () => {
			resolve(request.result as IndexedDBSyncItem[]);
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Reads items from an IndexedDB index with an optional key range
 * Note: Index existence is validated at collection creation time
 */
function getAllFromIndex(
	db: IDBDatabase,
	storeName: string,
	indexName: string,
	keyRange?: IDBKeyRange,
): Promise<IndexedDBSyncItem[]> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, "readonly");

		const store = transaction.objectStore(storeName);

		const index = store.index(indexName);

		const request = keyRange ? index.getAll(keyRange) : index.getAll();

		request.onsuccess = () => {
			resolve(request.result as IndexedDBSyncItem[]);
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Attempts to extract a simple indexed query from an IR expression
 * Returns the field name and key range if the query can be optimized
 *
 * NOTE: IndexedDB indexes are much more limited than SQL WHERE clauses:
 * - Only supports simple comparisons on a SINGLE indexed field
 * - Supported operators: eq, gt, gte, lt, lte
 * - Complex queries (AND, OR, NOT, multiple fields) fall back to in-memory filtering
 *
 * Indexes are auto-discovered from your Drizzle schema:
 * - Define indexes using index().on() in your schema
 * - Run migrations to create them in IndexedDB
 * - This collection automatically detects and uses them
 */
function tryExtractIndexedQuery(
	expression: IR.BasicExpression,
	indexes?: Record<string, string>,
	debug?: boolean,
): { fieldName: string; indexName: string; keyRange: IDBKeyRange } | null {
	if (!indexes) {
		return null;
	}

	try {
		// Use TanStack DB helper to extract simple comparisons
		const comparisons = extractSimpleComparisons(expression);

		// We can only use an index for a single field
		if (comparisons.length !== 1) {
			return null;
		}

		const comparison = comparisons[0];
		const fieldName = comparison.field.join(".");
		const indexName = indexes[fieldName];

		if (!indexName) {
			return null;
		}

		// Convert operator to IndexedDB key range

		let keyRange: IDBKeyRange | null = null;

		switch (comparison.operator) {
			case "eq":
				keyRange = IDBKeyRange.only(comparison.value);
				break;
			case "gt":
				keyRange = IDBKeyRange.lowerBound(comparison.value, true);
				break;
			case "gte":
				keyRange = IDBKeyRange.lowerBound(comparison.value, false);
				break;
			case "lt":
				keyRange = IDBKeyRange.upperBound(comparison.value, true);
				break;
			case "lte":
				keyRange = IDBKeyRange.upperBound(comparison.value, false);
				break;
			default:
				if (debug) {
					console.warn(
						`Skipping indexed query extraction for unsupported operator: ${comparison.operator}`,
					);
				}
				return null;
		}

		if (!keyRange) {
			return null;
		}

		return { fieldName, indexName, keyRange };
	} catch (error) {
		console.error("Error extracting indexed query", error, expression);
		// If extractSimpleComparisons fails, it's a complex query

		return null;
	}
}

/**
 * Adds an item to an IndexedDB object store using an existing transaction
 */
function addToStoreInTransaction(
	store: IDBObjectStore,
	item: IndexedDBSyncItem,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = store.add(item);

		request.onsuccess = () => {
			resolve();
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Updates an item in an IndexedDB object store using an existing transaction
 */
function updateInStoreInTransaction(
	store: IDBObjectStore,
	item: IndexedDBSyncItem,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = store.put(item);

		request.onsuccess = () => {
			resolve();
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Deletes an item from an IndexedDB object store using an existing transaction
 */
function deleteFromStoreInTransaction(
	store: IDBObjectStore,
	id: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = store.delete(id);

		request.onsuccess = () => {
			resolve();
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Gets a single item from an IndexedDB object store by ID using an existing transaction
 */
function getFromStoreInTransaction(
	store: IDBObjectStore,
	id: AnyId,
): Promise<IndexedDBSyncItem | undefined> {
	return new Promise((resolve, reject) => {
		const request = store.get(id);

		request.onsuccess = () => {
			resolve(request.result as IndexedDBSyncItem | undefined);
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

/**
 * Executes a transaction and returns a promise that resolves when the transaction completes
 */
function commitTransaction(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => {
			resolve();
		};

		transaction.onerror = () => {
			reject(transaction.error);
		};

		transaction.onabort = () => {
			reject(new Error("Transaction aborted"));
		};
	});
}

/**
 * Auto-discovers indexes from the IndexedDB store
 * Returns a map of field names to index names for single-column indexes
 *
 * NOTE: Indexes are created automatically by Drizzle migrations based on your schema:
 *
 * @example
 * // In your schema.ts:
 * export const todoTable = syncableTable(
 *   "todo",
 *   { title: text("title"), userId: text("userId") },
 *   (t) => [
 *     index("todo_user_id_index").on(t.userId),
 *     index("todo_created_at_index").on(t.createdAt),
 *   ]
 * );
 *
 * // The migrator will automatically create these indexes in IndexedDB
 * // This collection will auto-detect and use them for optimized queries
 */
function discoverIndexes(
	db: IDBDatabase,
	storeName: string,
): Record<string, string> {
	if (!db.objectStoreNames.contains(storeName)) {
		return {};
	}

	const transaction = db.transaction(storeName, "readonly");

	const store = transaction.objectStore(storeName);

	const indexMap: Record<string, string> = {};

	// Iterate through all indexes in the store
	const indexNames = Array.from(store.indexNames);

	for (const indexName of indexNames) {
		const index = store.index(indexName);
		const keyPath = index.keyPath;

		// Only map single-column indexes (string keyPath)
		// Compound indexes (array keyPath) are more complex and not currently optimized
		if (typeof keyPath === "string") {
			indexMap[keyPath] = indexName;
		}
	}

	return indexMap;
}

/**
 * Creates a TanStack DB collection config for IndexedDB
 */
export function indexedDBCollectionOptions<const TTable extends Table>(
	config: IndexedDBCollectionConfig<TTable>,
) {
	// Defer index discovery until the database is ready
	let discoveredIndexes: Record<string, string> = {};
	let indexesDiscovered = false;

	const table = config.table;

	// Discover indexes once when the database is ready
	const discoverIndexesOnce = async () => {
		await config.readyPromise;

		if (!indexesDiscovered) {
			discoveredIndexes = discoverIndexes(
				// biome-ignore lint/style/noNonNullAssertion: DB is guaranteed to be ready after readyPromise resolves
				config.indexedDBRef.current!,
				config.storeName,
			);

			indexesDiscovered = true;
		}
	};

	// Create backend-specific implementation
	const backend: SyncBackend<TTable> = {
		initialLoad: async (write) => {
			await discoverIndexesOnce();

			const items = await getAllFromStore(
				// biome-ignore lint/style/noNonNullAssertion: DB is guaranteed to be ready after readyPromise resolves
				config.indexedDBRef.current!,
				config.storeName,
			);

			for (const item of items) {
				write(item as unknown as InferSchemaOutput<SelectSchema<TTable>>);
			}
		},

		loadSubset: async (options, write) => {
			// Ensure indexes are discovered before we try to use them
			if (!indexesDiscovered) {
				discoveredIndexes = discoverIndexes(
					// biome-ignore lint/style/noNonNullAssertion: DB is guaranteed to be ready after readyPromise resolves
					config.indexedDBRef.current!,
					config.storeName,
				);
				indexesDiscovered = true;
			}

			let items: IndexedDBSyncItem[];

			// Try to use an index for efficient querying
			const indexedQuery = options.where
				? tryExtractIndexedQuery(options.where, discoveredIndexes, config.debug)
				: null;

			if (indexedQuery) {
				// Use indexed query for better performance
				items = await getAllFromIndex(
					// biome-ignore lint/style/noNonNullAssertion: DB is guaranteed to be ready after readyPromise resolves
					config.indexedDBRef.current!,
					config.storeName,
					indexedQuery.indexName,
					indexedQuery.keyRange,
				);
			} else {
				// Fall back to getting all items
				items = await getAllFromStore(
					// biome-ignore lint/style/noNonNullAssertion: DB is guaranteed to be ready after readyPromise resolves
					config.indexedDBRef.current!,
					config.storeName,
				);

				// Apply where filter in memory
				if (options.where) {
					const whereExpression = options.where;
					items = items.filter((item) =>
						evaluateExpression(
							whereExpression,
							item as Record<string, unknown>,
						),
					);
				}
			}

			// Apply orderBy
			if (options.orderBy) {
				const sorts = parseOrderByExpression(options.orderBy);
				items.sort((a, b) => {
					for (const sort of sorts) {
						// Access nested field (though typically will be single level)
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

			// Apply limit
			if (options.limit !== undefined) {
				items = items.slice(0, options.limit);
			}

			for (const item of items) {
				write(item as unknown as InferSchemaOutput<SelectSchema<TTable>>);
			}
		},

		handleInsert: async (mutations) => {
			const results: Array<InferSchemaOutput<SelectSchema<TTable>>> = [];

			try {
				// Use a single transaction for all inserts
				// biome-ignore lint/style/noNonNullAssertion: DB is guaranteed to be ready after readyPromise resolves
				const transaction = config.indexedDBRef.current!.transaction(
					config.storeName,
					"readwrite",
				);
				const store = transaction.objectStore(config.storeName);

				const addPromises: Promise<void>[] = [];

				for (const mutation of mutations) {
					const itemToInsert = mutation.modified;

					// Add result for reactive store
					results.push(itemToInsert);

					// Add to IndexedDB in parallel (don't await yet)
					addPromises.push(
						addToStoreInTransaction(store, itemToInsert as IndexedDBSyncItem),
					);
				}

				// Wait for all IndexedDB writes to complete
				await Promise.all(addPromises);
				await commitTransaction(transaction);
			} catch (error) {
				// Clear results on error so nothing gets written to reactive store
				results.length = 0;
				throw error;
			}

			return results;
		},

		handleUpdate: async (mutations) => {
			const results: Array<InferSchemaOutput<SelectSchema<TTable>>> = [];
			const originalValues: Array<InferSchemaOutput<SelectSchema<TTable>>> = [];

			try {
				// Use a single transaction for all updates
				// biome-ignore lint/style/noNonNullAssertion: DB is guaranteed to be ready after readyPromise resolves
				const transaction = config.indexedDBRef.current!.transaction(
					config.storeName,
					"readwrite",
				);
				const store = transaction.objectStore(config.storeName);

				for (const mutation of mutations) {
					originalValues.push(mutation.original);

					const existing = await getFromStoreInTransaction(store, mutation.key);

					if (existing) {
						const updateTime = new Date();
						const updatedItem = {
							...existing,
							...mutation.changes,
							updatedAt: updateTime,
						} as IndexedDBSyncItem;

						await updateInStoreInTransaction(store, updatedItem);
						results.push(
							updatedItem as unknown as InferSchemaOutput<SelectSchema<TTable>>,
						);
					} else {
						// If item doesn't exist, push original to maintain order
						results.push(mutation.original);
					}
				}

				// Wait for transaction to complete
				await commitTransaction(transaction);
			} catch (error) {
				// On error, return original values to rollback the reactive store
				throw error;
			}

			return results;
		},

		handleDelete: async (mutations) => {
			try {
				// Use a single transaction for all deletes
				// biome-ignore lint/style/noNonNullAssertion: DB is guaranteed to be ready after readyPromise resolves
				const transaction = config.indexedDBRef.current!.transaction(
					config.storeName,
					"readwrite",
				);
				const store = transaction.objectStore(config.storeName);

				for (const mutation of mutations) {
					await deleteFromStoreInTransaction(store, mutation.key);
				}

				// Wait for transaction to complete
				await commitTransaction(transaction);
			} catch (error) {
				throw error;
			}
		},
	};

	// For non-eager sync modes, still discover indexes before marking ready
	const wrappedBackend: SyncBackend<TTable> = {
		...backend,
		initialLoad: async (write) => {
			if (config.syncMode === "eager" || !config.syncMode) {
				await backend.initialLoad(write);
			} else {
				// For non-eager sync modes, still discover indexes but don't load data
				await discoverIndexesOnce();
			}
		},
	};

	// Create sync function using shared utilities
	const baseSyncConfig: BaseSyncConfig<TTable> = {
		table,
		readyPromise: config.readyPromise,
		syncMode: config.syncMode,
		debug: config.debug,
	};

	const syncResult = createSyncFunction(baseSyncConfig, wrappedBackend);

	// Create insert schema with all defaults (IndexedDB needs them upfront)
	const schema = createInsertSchemaWithDefaults(table);

	// Create collection config using shared utilities
	return createCollectionConfig({
		schema,
		getKey: createGetKeyFunction<TTable>(),
		syncResult,
		syncMode: config.syncMode,
	});
}
