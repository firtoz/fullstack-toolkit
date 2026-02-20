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

import type { IDBDatabaseLike, KeyRangeSpec } from "../idb-types";

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
 * @internal Exported for testing
 */
export function evaluateExpression(
	expression: IR.BasicExpression,
	item: Record<string, unknown>,
): boolean {
	switch (expression.type) {
		case "ref": {
			const propRef = expression;
			const columnName = propRef.path[propRef.path.length - 1];
			return item[columnName as string] !== undefined;
		}
		case "val": {
			const value = expression;
			return !!value.value;
		}
		case "func": {
			const func = expression;

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
		default: {
			const _ex: never = expression;
			void _ex;
			throw new Error(
				`Unsupported expression type: ${(expression as { type: string }).type}`,
			);
		}
	}
}

/**
 * Gets the value from an IR expression
 * @internal Exported for testing
 */
export function getExpressionValue(
	expression: IR.BasicExpression,
	item: Record<string, unknown>,
	// biome-ignore lint/suspicious/noExplicitAny: We need any here for dynamic values
): any {
	switch (expression.type) {
		case "ref": {
			const propRef = expression;
			const columnName = propRef.path[propRef.path.length - 1];
			return item[columnName as string];
		}
		case "val": {
			const value = expression;
			return value.value;
		}
		case "func":
			throw new Error("Cannot get value from func expression");
		default: {
			const _ex: never = expression;
			void _ex;
			throw new Error(
				`Cannot get value from expression type: ${(expression as { type: string }).type}`,
			);
		}
	}
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
 * @internal Exported for testing
 */
export function tryExtractIndexedQuery(
	expression: IR.BasicExpression,
	indexes?: Record<string, string>,
	debug?: boolean,
): { fieldName: string; indexName: string; keyRange: KeyRangeSpec } | null {
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

		// Convert operator to key range spec
		let keyRange: KeyRangeSpec | null = null;

		switch (comparison.operator) {
			case "eq":
				keyRange = { type: "only", value: comparison.value };
				break;
			case "gt":
				keyRange = {
					type: "lowerBound",
					lower: comparison.value,
					lowerOpen: true,
				};
				break;
			case "gte":
				keyRange = {
					type: "lowerBound",
					lower: comparison.value,
					lowerOpen: false,
				};
				break;
			case "lt":
				keyRange = {
					type: "upperBound",
					upper: comparison.value,
					upperOpen: true,
				};
				break;
			case "lte":
				keyRange = {
					type: "upperBound",
					upper: comparison.value,
					upperOpen: false,
				};
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

// Note: Low-level transaction helpers have been replaced by high-level IDBDatabaseLike methods

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
	db: IDBDatabaseLike,
	storeName: string,
): Record<string, string> {
	const indexes = db.getStoreIndexes(storeName);
	const indexMap: Record<string, string> = {};

	for (const index of indexes) {
		// Only map single-column indexes (string keyPath)
		// Compound indexes (array keyPath) are more complex and not currently optimized
		if (typeof index.keyPath === "string") {
			indexMap[index.keyPath] = index.name;
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

		const db = config.indexedDBRef.current;
		if (!db) {
			throw new Error("Database not ready");
		}

		if (!indexesDiscovered) {
			discoveredIndexes = discoverIndexes(db, config.storeName);

			indexesDiscovered = true;
		}
	};

	// Create backend-specific implementation
	const backend: SyncBackend<TTable> = {
		initialLoad: async () => {
			const db = config.indexedDBRef.current;
			if (!db) {
				throw new Error("Database not ready");
			}

			await discoverIndexesOnce();

			const items = await db.getAll<IndexedDBSyncItem>(config.storeName);

			return items as unknown as InferSchemaOutput<SelectSchema<TTable>>[];
		},
		loadSubset: async (options) => {
			const db = config.indexedDBRef.current;
			if (!db) {
				throw new Error("Database not ready");
			}

			// Ensure indexes are discovered before we try to use them
			if (!indexesDiscovered) {
				discoveredIndexes = discoverIndexes(db, config.storeName);
				indexesDiscovered = true;
			}

			let items: IndexedDBSyncItem[];

			// Combine where with cursor expressions if present
			// The cursor.whereFrom gives us rows after the cursor position
			let combinedWhere = options.where;
			if (options.cursor?.whereFrom) {
				if (combinedWhere) {
					// Combine main where with cursor expression using AND
					combinedWhere = {
						type: "func",
						name: "and",
						args: [combinedWhere, options.cursor.whereFrom],
					} as IR.Func;
				} else {
					combinedWhere = options.cursor.whereFrom;
				}
			}

			// Try to use an index for efficient querying
			const indexedQuery = combinedWhere
				? tryExtractIndexedQuery(combinedWhere, discoveredIndexes, config.debug)
				: null;

			if (indexedQuery) {
				// Use indexed query for better performance
				// Index returns exact results for single-field queries, no additional filtering needed
				items = await db.getAllByIndex<IndexedDBSyncItem>(
					config.storeName,
					indexedQuery.indexName,
					indexedQuery.keyRange,
				);
			} else {
				// Fall back to getting all items
				items = await db.getAll<IndexedDBSyncItem>(config.storeName);

				// Apply combined where filter in memory
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

			// Apply offset (skip first N items for pagination)
			if (options.offset !== undefined && options.offset > 0) {
				items = items.slice(options.offset);
			}

			// Apply limit
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

			// Add all items in a single batch operation
			await db.add(config.storeName, itemsToInsert);

			return itemsToInsert;
		},

		handleUpdate: async (mutations) => {
			const db = config.indexedDBRef.current;

			if (!db) {
				throw new Error("Database not ready");
			}

			const results: Array<InferSchemaOutput<SelectSchema<TTable>>> = [];
			const itemsToUpdate: IndexedDBSyncItem[] = [];

			for (const mutation of mutations) {
				const existing = await db.get<IndexedDBSyncItem>(
					config.storeName,
					mutation.key,
				);

				if (existing) {
					const updateTime = new Date();
					const updatedItem = {
						...existing,
						...mutation.changes,
						updatedAt: updateTime,
					} as IndexedDBSyncItem;

					itemsToUpdate.push(updatedItem);
					results.push(
						updatedItem as unknown as InferSchemaOutput<SelectSchema<TTable>>,
					);
				} else {
					// If item doesn't exist, push original to maintain order
					results.push(mutation.original);
				}
			}

			// Update all items in a single batch operation
			if (itemsToUpdate.length > 0) {
				await db.put(config.storeName, itemsToUpdate);
			}

			return results;
		},

		handleDelete: async (mutations) => {
			const db = config.indexedDBRef.current;

			if (!db) {
				throw new Error("Database not ready");
			}

			const keysToDelete: IDBValidKey[] = mutations.map((m) => m.key);

			// Delete all items in a single batch operation
			await db.delete(config.storeName, keysToDelete);
		},

		handleTruncate: async () => {
			const db = config.indexedDBRef.current;

			if (!db) {
				throw new Error("Database not ready");
			}

			// Clear all items from the store
			await db.clear(config.storeName);
		},
	};

	// For non-eager sync modes, still discover indexes before marking ready
	const wrappedBackend: SyncBackend<TTable> = {
		...backend,
		initialLoad: async () => {
			if (config.syncMode === "eager" || !config.syncMode) {
				return await backend.initialLoad();
			}

			// For non-eager sync modes, still discover indexes but don't load data
			await discoverIndexesOnce();

			return [];
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
