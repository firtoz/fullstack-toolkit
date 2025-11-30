export {
	migrateIndexedDBWithFunctions,
	type IndexedDBMigrationFunction,
} from "./function-migrator";

export { deleteIndexedDB } from "./utils";

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
