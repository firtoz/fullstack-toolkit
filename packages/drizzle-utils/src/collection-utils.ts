import { type Table, SQL, getTableColumns } from "drizzle-orm";
import type { BuildSchema } from "drizzle-valibot";
import { createInsertSchema } from "drizzle-valibot";
import * as v from "valibot";
import type {
	Collection,
	UtilsRecord,
	CollectionConfig,
	InferSchemaOutput,
	SyncConfig,
	SyncConfigRes,
	SyncMode,
	LoadSubsetOptions,
} from "@tanstack/db";
import { DeduplicatedLoadSubset } from "@tanstack/db";

/**
 * Utility type for branded IDs
 */
export type Branded<T, Brand> = T & { __brand: Brand };

export type TableId<TTableName extends string> = Branded<
	string,
	`${TTableName}_id`
>;

/**
 * Utility type to extract the ID type from a table
 */
export type IdOf<TTable extends Table> = TTable extends {
	$inferSelect: { id: infer TId extends string | number };
}
	? TId
	: string | number;

/**
 * Utility function to safely create branded IDs
 */
export function makeId<TTable extends Table>(
	_table: TTable,
	value: string,
): IdOf<TTable> {
	return value as IdOf<TTable>;
}

/**
 * Select schema type helper
 */
export type SelectSchema<TTable extends Table> = BuildSchema<
	"select",
	TTable["_"]["columns"],
	undefined
>;

/**
 * Insert schema type helper
 */
export type InsertSchema<TTable extends Table> = BuildSchema<
	"insert",
	TTable["_"]["columns"],
	undefined
>;

/**
 * Helper type to get the table from schema by name
 */
export type GetTableFromSchema<
	TSchema extends Record<string, unknown>,
	TTableName extends keyof TSchema,
> = TSchema[TTableName] extends Table ? TSchema[TTableName] : never;

/**
 * Helper type to infer the collection type from table
 * This provides proper typing for Collection insert/update operations
 */
export type InferCollectionFromTable<TTable extends Table> = Collection<
	TTable["$inferSelect"],
	IdOf<TTable>,
	UtilsRecord,
	SelectSchema<TTable>,
	Omit<
		TTable["$inferInsert"],
		"id"
		// "createdAt" | "updatedAt" | "deletedAt" | "id"
	> & {
		id?: IdOf<TTable>;
	}
>;

// WORKAROUND: DeduplicatedLoadSubset has a bug where toggling queries (e.g., isNull/isNotNull)
// creates invalid expressions like not(or(isNull(...), not(isNull(...))))
// See: https://github.com/TanStack/db/issues/828
// TODO: Re-enable once the bug is fixed
export const USE_DEDUPE = false as boolean;

/**
 * Base configuration for sync lifecycle management
 */
export interface BaseSyncConfig<TTable extends Table> {
	/**
	 * The Drizzle table definition
	 */
	table: TTable;
	/**
	 * Promise that resolves when the database is ready
	 */
	readyPromise: Promise<void>;
	/**
	 * Sync mode: 'eager' (immediate) or 'lazy' (on-demand)
	 */
	syncMode?: SyncMode;
	/**
	 * Enable debug logging
	 */
	debug?: boolean;
}

/**
 * Backend-specific implementations required for sync
 */
export interface SyncBackend<TTable extends Table> {
	/**
	 * Initial data load - should call write() for each item
	 */
	initialLoad: () => Promise<Array<InferSchemaOutput<SelectSchema<TTable>>>>;
	/**
	 * Load a subset of data based on query options
	 */
	loadSubset: (
		options: LoadSubsetOptions,
	) => Promise<Array<InferSchemaOutput<SelectSchema<TTable>>>>;
	/**
	 * Handle insert mutations
	 */
	handleInsert: (
		items: Array<InferSchemaOutput<SelectSchema<TTable>>>,
	) => Promise<Array<InferSchemaOutput<SelectSchema<TTable>>>>;
	/**
	 * Handle update mutations
	 */
	handleUpdate: (
		mutations: Array<{
			key: string;
			changes: Partial<InferSchemaOutput<SelectSchema<TTable>>>;
			original: InferSchemaOutput<SelectSchema<TTable>>;
		}>,
	) => Promise<Array<InferSchemaOutput<SelectSchema<TTable>>>>;
	/**
	 * Handle delete mutations
	 */
	handleDelete: (
		mutations: Array<{
			key: string;
			modified: InferSchemaOutput<SelectSchema<TTable>>;
			original: InferSchemaOutput<SelectSchema<TTable>>;
		}>,
	) => Promise<void>;
	/**
	 * Handle truncate (clear all data from store)
	 * Optional - if not provided, truncate util won't be available
	 */
	handleTruncate?: () => Promise<void>;
}

/**
 * External sync event for pushing changes from outside (e.g., from a proxy server)
 */
export type ExternalSyncEvent<T> =
	| { type: "insert"; items: T[] }
	| { type: "update"; items: T[] }
	| { type: "delete"; items: T[] }
	| { type: "truncate" };

/**
 * Handler for external sync events
 */
export type ExternalSyncHandler<T> = (event: ExternalSyncEvent<T>) => void;

/**
 * Collection utils that include truncate and external sync functionality
 */
export interface CollectionUtils<T = unknown> {
	/**
	 * Clear all data from the store (truncate).
	 * This clears the backend store and updates the local reactive store.
	 */
	truncate: () => Promise<void>;
	/**
	 * Push external sync events to the collection.
	 * Use this when receiving sync messages from a proxy server or other external source.
	 */
	pushExternalSync: ExternalSyncHandler<T>;
}

/**
 * Return type for createSyncFunction that includes both sync config and listeners
 */
export type SyncFunctionResult<TTable extends Table> = {
	sync: SyncConfig<InferSchemaOutput<SelectSchema<TTable>>, string>["sync"];
	onInsert: CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>["onInsert"];
	onUpdate: CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>["onUpdate"];
	onDelete: CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>["onDelete"];
	/**
	 * Collection utilities including truncate and external sync
	 */
	utils: CollectionUtils<InferSchemaOutput<SelectSchema<TTable>>>;
};

/**
 * Creates the sync function with common lifecycle management
 */
export function createSyncFunction<TTable extends Table>(
	config: BaseSyncConfig<TTable>,
	backend: SyncBackend<TTable>,
): SyncFunctionResult<TTable> {
	type ItemType = InferSchemaOutput<SelectSchema<TTable>>;
	type CollectionType = CollectionConfig<
		ItemType,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>;

	let insertListener: CollectionType["onInsert"];
	let updateListener: CollectionType["onUpdate"];
	let deleteListener: CollectionType["onDelete"];

	// Captured sync functions for external sync
	let syncBegin: (() => void) | null = null;
	let syncWrite:
		| ((op: { type: "insert" | "update" | "delete"; value: ItemType }) => void)
		| null = null;
	let syncCommit: (() => void) | null = null;
	let syncTruncate: (() => void) | null = null;

	const syncFn: SyncConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string
	>["sync"] = (params) => {
		const { begin, write, commit, markReady, truncate } = params;

		// Capture sync functions for external use
		syncBegin = begin;
		syncWrite = write;
		syncCommit = commit;
		syncTruncate = truncate;

		const initialSync = async () => {
			await config.readyPromise;

			try {
				const items = await backend.initialLoad();

				begin();

				for (const item of items) {
					write({
						type: "insert",
						value: item,
					});
				}

				commit();
			} finally {
				markReady();
			}
		};

		if (config.syncMode === "eager" || !config.syncMode) {
			initialSync();
		} else {
			markReady();
		}

		insertListener = async (params) => {
			const results = await backend.handleInsert(
				params.transaction.mutations.map((m) => m.modified),
			);

			begin();
			for (const result of results) {
				write({
					type: "insert",
					value: result,
				});
			}
			commit();
		};

		updateListener = async (params) => {
			const results = await backend.handleUpdate(params.transaction.mutations);

			begin();
			for (const result of results) {
				write({
					type: "update",
					value: result,
				});
			}
			commit();
		};

		deleteListener = async (params) => {
			await backend.handleDelete(params.transaction.mutations);

			begin();
			for (const item of params.transaction.mutations) {
				write({
					type: "delete",
					value: item.modified,
				});
			}
			commit();
		};

		const loadSubset = async (options: LoadSubsetOptions) => {
			await config.readyPromise;

			const items = await backend.loadSubset(options);

			begin();

			for (const item of items) {
				write({
					type: "insert",
					value: item,
				});
			}

			commit();
		};

		// Create deduplicated loadSubset wrapper to avoid redundant queries
		let loadSubsetDedupe: DeduplicatedLoadSubset | null = null;
		if (USE_DEDUPE) {
			loadSubsetDedupe = new DeduplicatedLoadSubset({
				loadSubset,
			});
		}

		return {
			cleanup: () => {
				insertListener = undefined;
				updateListener = undefined;
				deleteListener = undefined;
				loadSubsetDedupe?.reset();
			},
			loadSubset: loadSubsetDedupe?.loadSubset ?? loadSubset,
		} satisfies SyncConfigRes;
	};

	// External sync handler - allows pushing sync events from outside (e.g., proxy server)
	const pushExternalSync: ExternalSyncHandler<ItemType> = (event) => {
		if (!syncBegin || !syncWrite || !syncCommit || !syncTruncate) {
			if (config.debug) {
				console.warn(
					"[pushExternalSync] Sync functions not initialized yet - event will be dropped",
					event,
				);
			}
			return;
		}

		switch (event.type) {
			case "insert":
				syncBegin();
				for (const item of event.items) {
					syncWrite({ type: "insert", value: item });
				}
				syncCommit();
				break;
			case "update":
				syncBegin();
				for (const item of event.items) {
					syncWrite({ type: "update", value: item });
				}
				syncCommit();
				break;
			case "delete":
				syncBegin();
				for (const item of event.items) {
					syncWrite({ type: "delete", value: item });
				}
				syncCommit();
				break;
			case "truncate":
				syncBegin();
				syncTruncate();
				syncCommit();
				break;
		}
	};

	// Create utils with truncate and external sync
	const utils: CollectionUtils<ItemType> = {
		truncate: async () => {
			if (!backend.handleTruncate) {
				throw new Error("Truncate not supported by this backend");
			}
			if (!syncBegin || !syncTruncate || !syncCommit) {
				throw new Error(
					"Sync functions not initialized - sync function may not have been called yet",
				);
			}
			// Clear the backend store
			await backend.handleTruncate();
			// Update local reactive store (same pattern as insert/update/delete listeners)
			syncBegin();
			syncTruncate();
			syncCommit();
		},
		pushExternalSync,
	};

	return {
		sync: syncFn,
		onInsert: async (params) => {
			if (!insertListener) {
				throw new Error(
					"insertListener not initialized - sync function may not have been called yet",
				);
			}
			return insertListener(params);
		},
		onUpdate: async (params) => {
			if (!updateListener) {
				throw new Error(
					"updateListener not initialized - sync function may not have been called yet",
				);
			}
			return updateListener(params);
		},
		onDelete: async (params) => {
			if (!deleteListener) {
				throw new Error(
					"deleteListener not initialized - sync function may not have been called yet",
				);
			}
			return deleteListener(params);
		},
		utils,
	};
}

/**
 * Creates an insert schema with default value handling
 * Validates that SQL expressions are not used for defaults (IndexedDB compatibility)
 */
export function createInsertSchemaWithDefaults<TTable extends Table>(
	table: TTable,
): v.GenericSchema<unknown> {
	const insertSchema = createInsertSchema(table);
	const columns = getTableColumns(table);

	// Validate that no SQL expressions are used as defaults
	for (const columnName in columns) {
		const column = columns[columnName];

		let defaultValue: unknown | undefined;
		if (column.defaultFn) {
			defaultValue = column.defaultFn();
		} else if (column.default !== undefined) {
			defaultValue = column.default;
		}

		if (defaultValue instanceof SQL) {
			throw new Error(
				`Default value for column ${columnName} is a SQL expression, which is not supported for IndexedDB`,
			);
		}
	}

	// Transform the schema to apply defaults
	return v.pipe(
		insertSchema,
		v.transform((input) => {
			const result = { ...input } as Record<string, unknown>;

			for (const columnName in columns) {
				const column = columns[columnName];
				if (result[columnName] !== undefined) continue;

				let defaultValue: unknown | undefined;
				if (column.defaultFn) {
					defaultValue = column.defaultFn();
				} else if (column.default !== undefined) {
					defaultValue = column.default;
				}

				if (defaultValue instanceof SQL) {
					throw new Error(
						`Default value for column ${columnName} is a SQL expression, which is not supported for IndexedDB`,
					);
				}

				if (defaultValue !== undefined) {
					result[columnName] = defaultValue;
					continue;
				}

				if (column.notNull) {
					throw new Error(`Column ${columnName} is not nullable`);
				}

				result[columnName] = null;
			}

			return result;
		}),
	) as v.GenericSchema<unknown>;
}

/**
 * Creates a minimal insert schema that only applies ID defaults
 * Other defaults (like timestamps) are handled by the database
 */
export function createInsertSchemaWithIdDefault<TTable extends Table>(
	table: TTable,
): v.GenericSchema<unknown> {
	const insertSchema = createInsertSchema(table);
	const columns = getTableColumns(table);
	const idColumn = columns.id;

	return v.pipe(
		insertSchema,
		v.transform((input) => {
			const result = { ...input } as Record<string, unknown>;

			// Apply ID default if missing
			if (result.id === undefined && idColumn?.defaultFn) {
				result.id = idColumn.defaultFn();
			}

			return result;
		}),
	) as v.GenericSchema<unknown>;
}

/**
 * Standard getKey function for collections
 */
export function createGetKeyFunction<TTable extends Table>() {
	return (item: InferSchemaOutput<SelectSchema<TTable>>) => {
		const id = (item as { id: string }).id;
		return id;
	};
}

/**
 * Base collection config factory
 * Combines schema, sync, and event handlers into a collection config
 */
export function createCollectionConfig<
	TTable extends Table,
	TSchema extends v.GenericSchema<unknown>,
>(config: {
	schema: TSchema;
	getKey: (item: InferSchemaOutput<SelectSchema<TTable>>) => string;
	syncResult: SyncFunctionResult<TTable>;
	onInsert?: CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>["onInsert"];
	onUpdate?: CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>["onUpdate"];
	onDelete?: CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>["onDelete"];
	syncMode?: SyncMode;
}): Omit<
	CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>,
	"utils"
> & {
	schema: TSchema;
	utils: CollectionUtils<InferSchemaOutput<SelectSchema<TTable>>>;
} {
	return {
		schema: config.schema,
		getKey: config.getKey,
		sync: {
			sync: config.syncResult.sync,
		},
		// Merge provided handlers with sync result handlers (provided handlers take precedence)
		onInsert: config.onInsert ?? config.syncResult.onInsert,
		onUpdate: config.onUpdate ?? config.syncResult.onUpdate,
		onDelete: config.onDelete ?? config.syncResult.onDelete,
		syncMode: config.syncMode,
		// Include utils with truncate and pushExternalSync
		utils: config.syncResult.utils,
	};
}
