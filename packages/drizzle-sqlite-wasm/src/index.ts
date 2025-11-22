export { drizzleSqliteWasm } from "./drizzle/direct";
export {
	sqliteCollectionOptions as drizzleCollectionOptions,
	type SQLOperation,
	type SQLInterceptor,
} from "./collections/sqlite-collection";
export { syncableTable } from "@firtoz/drizzle-utils";
export { makeId } from "@firtoz/drizzle-utils";
export type {
	IdOf,
	TableId,
	Branded,
	SelectSchema,
	InsertSchema,
} from "@firtoz/drizzle-utils";
export { useDrizzleSqliteDb } from "./hooks/useDrizzleSqliteDb";
// SQLite WASM Provider
export {
	DrizzleSqliteProvider,
	DrizzleSqliteContext,
	useSqliteCollection,
} from "./context/DrizzleSqliteProvider";
export type { DrizzleSqliteContextValue } from "./context/DrizzleSqliteProvider";
export { useDrizzleSqlite } from "./context/useDrizzleSqlite";
export type { UseDrizzleSqliteReturn } from "./context/useDrizzleSqlite";

export {
	initializeSqliteWorker,
	getSqliteWorkerManager,
	isSqliteWorkerInitialized,
	resetSqliteWorkerManager,
} from "./worker/global-manager";
export { SqliteWorkerManager, DbInstance } from "./worker/manager";
export type { ISqliteWorkerClient } from "./worker/manager";
export { customSqliteMigrate } from "./migration/migrator";
export type { DurableSqliteMigrationConfig } from "./migration/migrator";
