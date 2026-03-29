import type { CollectionUtils } from "@firtoz/db-helpers";
import {
	type GenericBaseSyncConfig,
	type GenericSyncBackend,
	type GenericSyncFunctionResult,
	createGenericSyncFunction,
	createGenericCollectionConfig,
	USE_DEDUPE as _USE_DEDUPE,
} from "@firtoz/db-helpers";
import { type Table, SQL, getTableColumns } from "drizzle-orm";
import type { BuildSchema } from "drizzle-valibot";
import { createInsertSchema } from "drizzle-valibot";
import * as v from "valibot";
import type {
	Collection,
	UtilsRecord,
	CollectionConfig,
	InferSchemaOutput,
	SyncMode,
} from "@tanstack/db";

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
 * Schema type with insert input (optionals for defaults) and select output (all fields present).
 * Represents the standard input/output pair for collection schemas.
 */
export type InsertToSelectSchema<TTable extends Table> = v.GenericSchema<
	v.InferInput<InsertSchema<TTable>>,
	v.InferOutput<SelectSchema<TTable>>
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
	InsertToSelectSchema<TTable>,
	Omit<
		TTable["$inferInsert"],
		"id"
		// "createdAt" | "updatedAt" | "deletedAt" | "id"
	> & {
		id?: IdOf<TTable>;
	}
>;

export const USE_DEDUPE = _USE_DEDUPE;

/**
 * Base configuration for sync lifecycle management.
 * Extends the generic (Drizzle-free) config with a Drizzle table reference.
 */
export interface BaseSyncConfig<TTable extends Table>
	extends GenericBaseSyncConfig<InferSchemaOutput<SelectSchema<TTable>>> {
	table: TTable;
}

/**
 * Backend-specific implementations required for sync.
 * Drizzle-typed alias for GenericSyncBackend.
 */
export type SyncBackend<TTable extends Table> = GenericSyncBackend<
	InferSchemaOutput<SelectSchema<TTable>>
>;

/**
 * Return type for createSyncFunction.
 * Drizzle-typed alias for GenericSyncFunctionResult.
 */
export type SyncFunctionResult<TTable extends Table> =
	GenericSyncFunctionResult<InferSchemaOutput<SelectSchema<TTable>>>;

/**
 * Creates the sync function with common lifecycle management.
 * Delegates to the generic (Drizzle-free) implementation in @firtoz/db-helpers.
 */
export function createSyncFunction<TTable extends Table>(
	config: BaseSyncConfig<TTable>,
	backend: SyncBackend<TTable>,
): SyncFunctionResult<TTable> {
	return createGenericSyncFunction(config, backend);
}

/**
 * Creates an insert schema with default value handling
 * Validates that SQL expressions are not used for defaults (IndexedDB compatibility)
 */
export function createInsertSchemaWithDefaults<TTable extends Table>(
	table: TTable,
): InsertToSelectSchema<TTable> {
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
	) as InsertToSelectSchema<TTable>;
}

/**
 * Creates a minimal insert schema that only applies ID defaults
 * Other defaults (like timestamps) are handled by the database
 */
export function createInsertSchemaWithIdDefault<TTable extends Table>(
	table: TTable,
): InsertToSelectSchema<TTable> {
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
	) as InsertToSelectSchema<TTable>;
}

/**
 * Standard getKey function for collections
 */
export function createGetKeyFunction<TTable extends Table>() {
	type TItem = InferSchemaOutput<SelectSchema<TTable>>;
	type TKey = IdOf<TTable>;
	return (item: TItem): TKey => (item as { id: TKey }).id;
}

/**
 * Base collection config factory.
 * Delegates to the generic (Drizzle-free) implementation in @firtoz/db-helpers.
 */
export function createCollectionConfig<
	TTable extends Table,
	TSchema extends v.GenericSchema<unknown>,
>(config: {
	schema: TSchema;
	getKey: (item: InferSchemaOutput<SelectSchema<TTable>>) => IdOf<TTable>;
	syncResult: SyncFunctionResult<TTable>;
	onInsert?: CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		TSchema
	>["onInsert"];
	onUpdate?: CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		TSchema
	>["onUpdate"];
	onDelete?: CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		TSchema
	>["onDelete"];
	syncMode?: SyncMode;
}): Omit<
	CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		IdOf<TTable>,
		TSchema,
		CollectionUtils<InferSchemaOutput<SelectSchema<TTable>>>
	>,
	"utils"
> & {
	schema: TSchema;
	utils: CollectionUtils<InferSchemaOutput<SelectSchema<TTable>>>;
} {
	type TItem = InferSchemaOutput<SelectSchema<TTable>>;
	type ReturnType = Omit<
		CollectionConfig<TItem, IdOf<TTable>, TSchema, CollectionUtils<TItem>>,
		"utils"
	> & {
		schema: TSchema;
		utils: CollectionUtils<TItem>;
	};

	const { getKey: getId, ...rest } = config;
	return createGenericCollectionConfig<TItem, TSchema>({
		...rest,
		// Generic sync is typed with string keys; runtime id may be number — same value as Drizzle row id.
		getKey: (item: TItem) => getId(item) as string,
	}) as ReturnType;
}
