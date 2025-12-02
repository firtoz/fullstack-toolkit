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
	KeyRangeSpec,
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
	indexedDBCollectionOptions,
	type IndexedDBCollectionConfig,
	type IndexedDBSyncItem,
} from "./collections/indexeddb-collection";

// IndexedDB Provider
export {
	DrizzleIndexedDBProvider,
	DrizzleIndexedDBContext,
	useIndexedDBCollection,
	type DrizzleIndexedDBContextValue,
} from "./context/DrizzleIndexedDBProvider";

export {
	useDrizzleIndexedDB,
	type UseDrizzleIndexedDBContextReturn,
} from "./context/useDrizzleIndexedDB";
