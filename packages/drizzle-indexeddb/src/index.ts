export {
	migrateIndexedDBWithFunctions,
	type Migration,
	type MigrationOperation,
	type CreateTableOperation,
	type DeleteTableOperation,
	type CreateIndexOperation,
	type DeleteIndexOperation,
} from "./function-migrator";

// IDB Types
export type {
	IDBCreator,
	IDBOpenOptions,
	IDBDatabaseLike,
	IDBDeleter,
	IndexInfo,
	CreateStoreOptions,
	CreateIndexOptions,
} from "./idb-types";

// IDB Interceptor (for testing/debugging)
export type { IDBInterceptor, IDBOperation } from "./idb-interceptor";

// IDB Operations
export { openIndexedDb, deleteIndexedDB } from "./idb-operations";

// Native IDB Implementation
export { defaultIDBCreator } from "./native-idb-database";

// Instrumented IDB (for testing)
export { createInstrumentedDbCreator } from "./instrumented-idb-database";

// Collection
export {
	drizzleIndexedDBCollectionOptions,
	type DrizzleIndexedDBCollectionConfig,
	type DrizzleIndexedDBCollectionConfigResult,
	type DrizzleIndexedDBCollection,
	type DrizzleIndexedDBSyncItem,
} from "./collections/drizzle-indexeddb-collection";

// Standalone Collection (for use outside React)
export {
	createStandaloneCollection,
	type StandaloneCollection,
	type StandaloneCollectionConfig,
} from "./standalone-collection";

// IndexedDB Provider
export {
	DrizzleIndexedDBProvider,
	DrizzleIndexedDBContext,
	useIndexedDBCollection,
	type DrizzleIndexedDBContextValue,
	type IndexedDbCollection,
} from "./context/DrizzleIndexedDBProvider";

export {
	useDrizzleIndexedDB,
	type UseDrizzleIndexedDBContextReturn,
} from "./context/useDrizzleIndexedDB";
