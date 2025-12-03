import type { KeyRangeSpec } from "../idb-types";

/**
 * Request body types (without the common fields)
 */
export type IDBProxyRequestBody =
	// Connection (client session, not database lifecycle)
	| { type: "connect" }
	| { type: "disconnect" }
	// Read operations
	| { type: "getAll"; storeName: string }
	| {
			type: "getAllByIndex";
			storeName: string;
			indexName: string;
			keyRange?: KeyRangeSpec;
	  }
	| { type: "get"; storeName: string; key: IDBValidKey }
	// Write operations
	| { type: "add"; storeName: string; items: unknown[] }
	| { type: "put"; storeName: string; items: unknown[] }
	| { type: "delete"; storeName: string; keys: IDBValidKey[] }
	| { type: "clear"; storeName: string }
	// Metadata (read-only)
	| { type: "getVersion" }
	| { type: "hasStore"; storeName: string }
	| { type: "getStoreNames" }
	| { type: "getStoreIndexes"; storeName: string };

/**
 * Full request type with all required fields
 */
export type IDBProxyRequest = {
	/** Unique request ID for correlating responses */
	id: string;
	/** Unique client ID for tracking who sent the request */
	clientId: string;
	/** Database name */
	dbName: string;
} & IDBProxyRequestBody;

/**
 * Response types for IDB proxy operations
 */
export type IDBProxyResponse =
	| { id: string; type: "success"; data?: unknown }
	| { id: string; type: "error"; error: string };

/**
 * Sync messages broadcast to clients when data changes.
 * These are sent from server to clients to keep them in sync.
 */
export type IDBProxySyncMessage = {
	/** Database that was modified */
	dbName: string;
	/** Store that was modified */
	storeName: string;
} & (
	| { type: "sync:add"; items: unknown[] }
	| { type: "sync:put"; items: unknown[] }
	| { type: "sync:delete"; keys: IDBValidKey[] }
	| { type: "sync:clear" }
);

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Generate a unique client ID
 */
export function generateClientId(): string {
	return `client-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
