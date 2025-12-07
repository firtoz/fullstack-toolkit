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

// IDB Proxy (for Chrome extension, messaging-based IDB access)
export {
	// Types
	type IDBProxyRequest,
	type IDBProxyRequestBody,
	type IDBProxyResponse,
	type IDBProxySyncMessage,
	generateRequestId,
	generateClientId,
	// Transport
	type IDBProxyClientTransport,
	type IDBProxyServerTransport,
	createInMemoryTransport,
	createMultiClientTransport,
	// Client
	IDBProxyClient,
	createProxyDbCreator,
	type SyncHandler,
	// Server
	IDBProxyServer,
	createProxyServer,
	type IDBProxyServerOptions,
	// Sync adapter (connects proxy sync to collection)
	createCollectionSyncHandler,
	combineSyncHandlers,
} from "./proxy";
