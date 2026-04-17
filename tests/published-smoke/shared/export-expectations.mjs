/**
 * Runtime named exports expected on each package's root `import * as mod` namespace.
 * Omit type-only exports (they do not exist at runtime).
 * @type {Record<string, readonly string[]>}
 */
export const EXPECTED_EXPORTS = {
	"@firtoz/maybe-error": ["success", "fail", "exhaustiveGuard"],
	"@firtoz/db-helpers": [
		"createMemoryCollection",
		"memoryCollectionOptions",
		"evaluateExpression",
		"DeferredWriteQueue",
		"USE_DEDUPE",
	],
	"@firtoz/drizzle-utils": [
		"makeId",
		"USE_DEDUPE",
		"createSyncFunction",
		"syncableTable",
		"createSqliteTableSyncBackend",
	],
	"@firtoz/idb-collections": [
		"keyvalCollectionOptions",
		"createKeyValCollection",
		"tryExtractIndexedQuery",
	],
	"@firtoz/collection-sync": [
		"DEFAULT_SYNC_COLLECTION_ID",
		"toSyncMessage",
		"SyncClientBridge",
		"SyncServerBridge",
		"withSync",
		"createSyncedCollection",
	],
	"@firtoz/drizzle-indexeddb": [
		"migrateIndexedDBWithFunctions",
		"openIndexedDb",
		"deleteIndexedDB",
		"defaultIDBCreator",
		"drizzleIndexedDBCollectionOptions",
		"createStandaloneCollection",
		"DrizzleIndexedDBProvider",
	],
	"@firtoz/drizzle-sqlite-wasm": [
		"drizzleSqliteWasm",
		"createSyncedSqliteCollection",
		"initializeSqliteWorker",
		"DrizzleSqliteProvider",
	],
	"@firtoz/drizzle-durable-sqlite": [
		"durableSqliteCollectionOptions",
		"applyDurableMutationIntents",
		"SyncableDurableObject",
		"QueryableDurableObject",
		"createDrizzleMutationStore",
	],
	"@firtoz/hono-fetcher": [
		"honoDirectFetcher",
		"honoDoFetcher",
		"honoFetcher",
	],
	"@firtoz/worker-helper": ["WorkerClient", "WorkerHelper"],
	"@firtoz/websocket-do": [
		"BaseSession",
		"BaseWebSocketDO",
		"StandardSchemaWebSocketDO",
		"parseStandardSchema",
	],
	"@firtoz/socka": [
		"defineSocka",
		"SockaError",
		"SOCKA_WIRE_VERSION",
		"decodeSockaWire",
	],
	"@firtoz/router-toolkit": [
		"formAction",
		"useCachedFetch",
		"useDynamicFetcher",
		"ConcurrentSubmitterProvider",
	],
	"@firtoz/chat-agent": [
		"ChatAgentBase",
		"defineTool",
		"parseClientMessage",
		"isClientMessage",
	],
	"@firtoz/chat-agent-sql": ["SqlChatAgent"],
	"@firtoz/chat-agent-drizzle": ["DrizzleChatAgent"],
};
