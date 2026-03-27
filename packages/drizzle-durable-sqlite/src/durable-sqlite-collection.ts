import type {
	InferSchemaOutput,
	SyncMode,
	CollectionConfig,
} from "@tanstack/db";
import type { Table } from "drizzle-orm";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
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

/**
 * Drizzle database type for `drizzle-orm/durable-sqlite` (Cloudflare DO SQLite).
 */
export type AnyDurableSqliteDatabase = DrizzleSqliteDODatabase<
	Record<string, unknown>
>;

export type DurableDrizzleSchema<TDrizzle extends AnyDurableSqliteDatabase> =
	TDrizzle["_"]["fullSchema"];

export interface DurableSqliteCollectionConfig<
	TDrizzle extends AnyDurableSqliteDatabase,
	TTableName extends ValidTableNames<DurableDrizzleSchema<TDrizzle>>,
> {
	drizzle: TDrizzle;
	tableName: ValidTableNames<DurableDrizzleSchema<TDrizzle>> extends never
		? {
				$error: "The schema needs to include at least one table that uses the syncableTable function.";
			}
		: TTableName;
	/**
	 * Await before running sync queries (e.g. migrations finishing). Omit or leave undefined to use an already-resolved promise (no extra wait).
	 */
	readyPromise?: Promise<void>;
	syncMode?: SyncMode;
	debug?: boolean;
	interceptor?: SQLInterceptor;
}

export type ValidTableNames<TSchema extends Record<string, unknown>> = {
	[K in keyof TSchema]: TSchema[K] extends TableWithRequiredFields ? K : never;
}[keyof TSchema];

export type DurableSqliteCollectionConfigResult<TTable extends Table> = Omit<
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

/**
 * TanStack DB collection configuration for a table stored in Durable Object SQLite via Drizzle.
 *
 * Uses `driverMode: "sync"` internally: DO SQLite runs `transactionSync`, so mutations use
 * `.all()` / `.run()` inside a synchronous transaction callback (see `createSqliteTableSyncBackend` in `@firtoz/drizzle-utils`).
 */
export function durableSqliteCollectionOptions<
	const TDrizzle extends AnyDurableSqliteDatabase,
	const TTableName extends string &
		ValidTableNames<DurableDrizzleSchema<TDrizzle>>,
	TTable extends DurableDrizzleSchema<TDrizzle>[TTableName] &
		TableWithRequiredFields,
>(
	config: DurableSqliteCollectionConfig<TDrizzle, TTableName>,
): DurableSqliteCollectionConfigResult<TTable> {
	const tableName = config.tableName as string &
		ValidTableNames<DurableDrizzleSchema<TDrizzle>>;

	const table = config.drizzle._.fullSchema[tableName] as TTable;

	const backend = createSqliteTableSyncBackend({
		drizzle: config.drizzle,
		table,
		tableName: config.tableName as string,
		debug: config.debug,
		interceptor: config.interceptor,
		driverMode: "sync",
	});

	const baseSyncConfig: BaseSyncConfig<TTable> = {
		table,
		readyPromise: config.readyPromise ?? Promise.resolve(),
		syncMode: config.syncMode,
		debug: config.debug,
	};

	const syncResult = createSyncFunction(baseSyncConfig, backend);

	const schema = createInsertSchemaWithIdDefault(table);

	return createCollectionConfig({
		schema,
		getKey: createGetKeyFunction<TTable>(),
		syncResult,
		onInsert: config.debug
			? async (params) => {
					console.log("onInsert", params);
					// biome-ignore lint/style/noNonNullAssertion: defined when sync runs
					await syncResult.onInsert!(params);
				}
			: undefined,
		onUpdate: config.debug
			? async (params) => {
					console.log("onUpdate", params);
					// biome-ignore lint/style/noNonNullAssertion: defined when sync runs
					await syncResult.onUpdate!(params);
				}
			: undefined,
		onDelete: config.debug
			? async (params) => {
					console.log("onDelete", params);
					// biome-ignore lint/style/noNonNullAssertion: defined when sync runs
					await syncResult.onDelete!(params);
				}
			: undefined,
		syncMode: config.syncMode,
	});
}
