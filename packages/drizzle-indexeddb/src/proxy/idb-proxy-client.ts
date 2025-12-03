import type {
	IDBDatabaseLike,
	IDBCreator,
	IDBOpenOptions,
	IndexInfo,
	CreateStoreOptions,
	CreateIndexOptions,
	KeyRangeSpec,
} from "../idb-types";
import type { IDBProxyClientTransport } from "./idb-proxy-transport";
import type {
	IDBProxyRequest,
	IDBProxyRequestBody,
	IDBProxyResponse,
	IDBProxySyncMessage,
} from "./idb-proxy-types";
import { generateRequestId, generateClientId } from "./idb-proxy-types";

/**
 * Handler for sync messages from the server
 */
export type SyncHandler = (message: IDBProxySyncMessage) => void;

/**
 * A proxy implementation of IDBDatabaseLike that sends all operations
 * to a remote server via a transport layer.
 *
 * This is used by content scripts or other clients that don't have
 * direct access to IndexedDB (e.g., in a Chrome extension context).
 *
 * The client manages a "connection" (session) to the server.
 * The server manages the actual database lifecycle.
 *
 * When other clients modify data, the server broadcasts sync messages
 * which this client receives and can handle via onSync().
 */
export class IDBProxyClient implements IDBDatabaseLike {
	private _version: number = 0;
	private _storeNames: string[] = [];
	private _storeIndexes: Map<string, IndexInfo[]> = new Map();
	private _connected: boolean = false;
	private _clientId: string;
	private _syncHandlers: Set<SyncHandler> = new Set();

	constructor(
		private dbName: string,
		private transport: IDBProxyClientTransport,
		clientId?: string,
	) {
		this._clientId = clientId ?? generateClientId();

		// Listen for sync messages from server
		this.transport.onSync((message) => {
			// Only handle messages for this database
			if (message.dbName === this.dbName) {
				for (const handler of this._syncHandlers) {
					handler(message);
				}
			}
		});
	}

	/**
	 * Get the unique client ID
	 */
	get clientId(): string {
		return this._clientId;
	}

	/**
	 * Register a handler for sync messages from other clients.
	 * Returns an unsubscribe function.
	 */
	onSync(handler: SyncHandler): () => void {
		this._syncHandlers.add(handler);
		return () => {
			this._syncHandlers.delete(handler);
		};
	}

	/**
	 * Connect to the server and fetch database metadata.
	 * The server will ensure the database is open and migrated.
	 */
	async connect(): Promise<void> {
		if (this._connected) {
			return;
		}

		// Tell the server we want to connect to this database
		const connectResponse = await this.sendRequest({ type: "connect" });

		if (connectResponse.type === "error") {
			throw new Error(connectResponse.error || "Failed to connect to database");
		}

		// Fetch metadata
		const versionResponse = await this.sendRequest({ type: "getVersion" });
		if (versionResponse.type === "success") {
			this._version = versionResponse.data as number;
		}

		const storeNamesResponse = await this.sendRequest({
			type: "getStoreNames",
		});
		if (storeNamesResponse.type === "success") {
			this._storeNames = storeNamesResponse.data as string[];
		}

		this._connected = true;
	}

	/**
	 * Disconnect from the server.
	 * This is a no-op since clients are cached and reused.
	 * The connection stays open for future use.
	 */
	disconnect(): void {
		// Intentionally a no-op - clients are cached and reused
	}

	private async sendRequest(
		request: IDBProxyRequestBody,
	): Promise<IDBProxyResponse> {
		const fullRequest: IDBProxyRequest = {
			...request,
			id: generateRequestId(),
			clientId: this._clientId,
			dbName: this.dbName,
		};
		return this.transport.sendRequest(fullRequest);
	}

	private handleResponse<T>(response: IDBProxyResponse): T {
		if (response.type === "error") {
			throw new Error(response.error || "Unknown server error");
		}
		return response.data as T;
	}

	get version(): number {
		return this._version;
	}

	// =========================================================================
	// Schema Operations - Cached locally, read-only for clients
	// =========================================================================

	hasStore(storeName: string): boolean {
		return this._storeNames.includes(storeName);
	}

	getStoreNames(): string[] {
		return [...this._storeNames];
	}

	createStore(_storeName: string, _options?: CreateStoreOptions): void {
		throw new Error(
			"Schema modifications not supported on proxy client. Use server-side migrations.",
		);
	}

	deleteStore(_storeName: string): void {
		throw new Error(
			"Schema modifications not supported on proxy client. Use server-side migrations.",
		);
	}

	createIndex(
		_storeName: string,
		_indexName: string,
		_keyPath: string | string[],
		_options?: CreateIndexOptions,
	): void {
		throw new Error(
			"Schema modifications not supported on proxy client. Use server-side migrations.",
		);
	}

	deleteIndex(_storeName: string, _indexName: string): void {
		throw new Error(
			"Schema modifications not supported on proxy client. Use server-side migrations.",
		);
	}

	getStoreIndexes(storeName: string): IndexInfo[] {
		const cached = this._storeIndexes.get(storeName);
		if (cached) {
			return cached;
		}
		return [];
	}

	/**
	 * Async version to fetch indexes from server
	 */
	async fetchStoreIndexes(storeName: string): Promise<IndexInfo[]> {
		const response = await this.sendRequest({
			type: "getStoreIndexes",
			storeName,
		});
		const indexes = this.handleResponse<IndexInfo[]>(response);
		this._storeIndexes.set(storeName, indexes);
		return indexes;
	}

	// =========================================================================
	// Data Operations - All proxied to server
	// =========================================================================

	async getAll<T = unknown>(storeName: string): Promise<T[]> {
		const response = await this.sendRequest({
			type: "getAll",
			storeName,
		});
		return this.handleResponse<T[]>(response);
	}

	async getAllByIndex<T = unknown>(
		storeName: string,
		indexName: string,
		keyRange?: KeyRangeSpec,
	): Promise<T[]> {
		const response = await this.sendRequest({
			type: "getAllByIndex",
			storeName,
			indexName,
			keyRange,
		});
		return this.handleResponse<T[]>(response);
	}

	async get<T = unknown>(
		storeName: string,
		key: IDBValidKey,
	): Promise<T | undefined> {
		const response = await this.sendRequest({
			type: "get",
			storeName,
			key,
		});
		return this.handleResponse<T | undefined>(response);
	}

	async add(storeName: string, items: unknown[]): Promise<void> {
		const response = await this.sendRequest({
			type: "add",
			storeName,
			items,
		});
		this.handleResponse<void>(response);
	}

	async put(storeName: string, items: unknown[]): Promise<void> {
		const response = await this.sendRequest({
			type: "put",
			storeName,
			items,
		});
		this.handleResponse<void>(response);
	}

	async delete(storeName: string, keys: IDBValidKey[]): Promise<void> {
		const response = await this.sendRequest({
			type: "delete",
			storeName,
			keys,
		});
		this.handleResponse<void>(response);
	}

	async clear(storeName: string): Promise<void> {
		const response = await this.sendRequest({
			type: "clear",
			storeName,
		});
		this.handleResponse<void>(response);
	}

	/**
	 * Close is an alias for disconnect.
	 * Required by IDBDatabaseLike interface.
	 */
	close(): void {
		this.disconnect();
	}
}

/**
 * Creates an IDBCreator that returns proxy clients connected to a remote server.
 * Clients are cached by database name, so multiple calls return the same client.
 *
 * @param transport The transport to use for communication
 * @param onSync Optional handler called when any sync message is received
 *
 * @example
 * const dbCreator = createProxyDbCreator(transport, (msg) => {
 *   console.log('Sync:', msg.type, msg.storeName);
 * });
 *
 * <DrizzleIndexedDBProvider dbCreator={dbCreator} ... />
 */
export function createProxyDbCreator(
	transport: IDBProxyClientTransport,
	onSync?: SyncHandler,
): IDBCreator {
	// Cache clients by database name - React may call dbCreator multiple times
	const clientCache = new Map<string, IDBProxyClient>();
	const connectingCache = new Map<string, Promise<IDBProxyClient>>();

	return async (
		name: string,
		_options?: IDBOpenOptions,
	): Promise<IDBDatabaseLike> => {
		// Return cached client if already connected
		const cached = clientCache.get(name);
		if (cached) {
			return cached;
		}

		// If currently connecting, wait for that connection
		const connecting = connectingCache.get(name);
		if (connecting) {
			return connecting;
		}

		// Create new client and connect
		const connectPromise = (async () => {
			const proxy = new IDBProxyClient(name, transport);

			// Register sync handler if provided
			if (onSync) {
				proxy.onSync(onSync);
			}

			await proxy.connect();
			clientCache.set(name, proxy);
			connectingCache.delete(name);
			return proxy;
		})();

		connectingCache.set(name, connectPromise);
		return connectPromise;
	};
}
