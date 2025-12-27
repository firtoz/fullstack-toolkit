// Proxy types
export {
	type IDBProxyRequest,
	type IDBProxyRequestBody,
	type IDBProxyResponse,
	type IDBProxySyncMessage,
	generateRequestId,
	generateClientId,
} from "./idb-proxy-types";

// Transport interfaces
export {
	type IDBProxyClientTransport,
	type IDBProxyServerTransport,
	createInMemoryTransport,
	createMultiClientTransport,
} from "./idb-proxy-transport";

// Proxy client
export {
	IDBProxyClient,
	createProxyIDbCreator,
	type SyncHandler,
} from "./idb-proxy-client";

// Proxy server
export {
	IDBProxyServer,
	createProxyServer,
	type IDBProxyServerOptions,
} from "./idb-proxy-server";

// Sync adapter (connects proxy sync to collection)
export {
	createCollectionSyncHandler,
	combineSyncHandlers,
} from "./idb-sync-adapter";
