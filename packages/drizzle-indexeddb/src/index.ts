export {
	migrateIndexedDBWithFunctions,
	type Migration,
	type MigrationOperation,
	type CreateTableOperation,
	type DeleteTableOperation,
	type CreateIndexOperation,
	type DeleteIndexOperation,
} from "./function-migrator";

export {
	deleteIndexedDB,
	type IDBCreator,
	type IDBOpenOptions,
	type IDBDatabaseLike,
	type IndexInfo,
	type CreateStoreOptions,
	type CreateIndexOptions,
	type KeyRangeSpec,
} from "./utils";

export {
	indexedDBCollectionOptions,
	type IndexedDBCollectionConfig,
	type IndexedDBSyncItem,
	type IDBInterceptor,
	type IDBOperation,
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
