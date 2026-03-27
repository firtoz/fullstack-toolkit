import type {
	InferSchemaOutput,
	SyncMode,
	CollectionConfig,
} from "@tanstack/db";
import type { Table } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type { CollectionUtils } from "@firtoz/db-helpers";
import type {
	SelectSchema,
	InsertToSelectSchema,
	TableWithRequiredFields,
	BaseSyncConfig,
	IdOf,
} from "@firtoz/drizzle-utils";
import {
	createSyncFunction,
	createInsertSchemaWithIdDefault,
	createGetKeyFunction,
	createCollectionConfig,
	createSqliteTableSyncBackend,
	type SQLOperation,
	type SQLInterceptor,
} from "@firtoz/drizzle-utils";
export type { SQLOperation, SQLInterceptor };

export type AnyDrizzleDatabase = BaseSQLiteDatabase<
	"async",
	// biome-ignore lint/suspicious/noExplicitAny: We really want to use any here.
	any,
	Record<string, unknown>
>;

export type DrizzleSchema<TDrizzle extends AnyDrizzleDatabase> =
	TDrizzle["_"]["fullSchema"];

export interface DrizzleSqliteCollectionConfig<
	TDrizzle extends AnyDrizzleDatabase,
	TTableName extends ValidTableNames<DrizzleSchema<TDrizzle>>,
> {
	drizzle: TDrizzle;
	tableName: ValidTableNames<DrizzleSchema<TDrizzle>> extends never
		? {
				$error: "The schema needs to include at least one table that uses the syncableTable function.";
			}
		: TTableName;
	readyPromise: Promise<void>;
	syncMode?: SyncMode;
	/**
	 * Enable debug logging for query execution and mutations
	 */
	debug?: boolean;
	/**
	 * Optional callback to checkpoint the database after mutations
	 * This ensures WAL is flushed to the main database file for OPFS persistence
	 */
	checkpoint?: () => Promise<void>;
	/**
	 * Optional interceptor for tracking SQLite operations (for testing/debugging)
	 */
	interceptor?: SQLInterceptor;
}

export type ValidTableNames<TSchema extends Record<string, unknown>> = {
	[K in keyof TSchema]: TSchema[K] extends TableWithRequiredFields ? K : never;
}[keyof TSchema];

export type SqliteCollectionConfig<TTable extends Table> = Omit<
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

export function sqliteCollectionOptions<
	const TDrizzle extends AnyDrizzleDatabase,
	const TTableName extends string & ValidTableNames<DrizzleSchema<TDrizzle>>,
	TTable extends DrizzleSchema<TDrizzle>[TTableName] & TableWithRequiredFields,
>(
	config: DrizzleSqliteCollectionConfig<TDrizzle, TTableName>,
): SqliteCollectionConfig<TTable> {
	const tableName = config.tableName as string &
		ValidTableNames<DrizzleSchema<TDrizzle>>;

	const table = config.drizzle?._.fullSchema[tableName] as TTable;

	const backend = createSqliteTableSyncBackend({
		drizzle: config.drizzle,
		table,
		tableName: config.tableName as string,
		debug: config.debug,
		checkpoint: config.checkpoint,
		interceptor: config.interceptor,
		driverMode: "async",
	});

	const baseSyncConfig: BaseSyncConfig<TTable> = {
		table,
		readyPromise: config.readyPromise,
		syncMode: config.syncMode,
		debug: config.debug,
	};

	const syncResult = createSyncFunction(baseSyncConfig, backend);

	const schema = createInsertSchemaWithIdDefault(table);

	const collectionConfig = createCollectionConfig({
		schema,
		getKey: createGetKeyFunction<TTable>(),
		syncResult,
		onInsert: config.debug
			? async (params) => {
					console.log("onInsert", params);
					// biome-ignore lint/style/noNonNullAssertion: onInsert is always defined in createSyncFunction
					await syncResult.onInsert!(params);
				}
			: undefined,
		onUpdate: config.debug
			? async (params) => {
					console.log("onUpdate", params);
					// biome-ignore lint/style/noNonNullAssertion: onUpdate is always defined in createSyncFunction
					await syncResult.onUpdate!(params);
				}
			: undefined,
		onDelete: config.debug
			? async (params) => {
					console.log("onDelete", params);
					// biome-ignore lint/style/noNonNullAssertion: onDelete is always defined in createSyncFunction
					await syncResult.onDelete!(params);
				}
			: undefined,
		syncMode: config.syncMode,
	});

	return collectionConfig;
}
