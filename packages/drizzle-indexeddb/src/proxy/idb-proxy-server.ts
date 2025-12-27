import type { IDBDatabaseLike, IDBCreator } from "../idb-types";
import { defaultIDBCreator } from "../native-idb-database";
import type { IDBProxyServerTransport } from "./idb-proxy-transport";
import type { IDBProxyRequest, IDBProxyResponse } from "./idb-proxy-types";

/**
 * Options for creating an IDB proxy server
 */
export interface IDBProxyServerOptions {
	/**
	 * Transport to receive requests from clients
	 */
	transport: IDBProxyServerTransport;

	/**
	 * Optional custom IDB creator (uses native IndexedDB by default)
	 */
	dbCreator?: IDBCreator;

	/**
	 * Called when a database needs to be initialized (first client connects).
	 * Use this to run migrations before the database is used.
	 */
	onDatabaseInit?: (dbName: string, db: IDBDatabaseLike) => Promise<void>;

	/**
	 * Enable debug logging
	 */
	debug?: boolean;
}

/**
 * IDB Proxy Server - Handles requests from proxy clients and performs
 * actual IndexedDB operations.
 *
 * The server manages database lifecycle:
 * - Databases are opened on first client connection
 * - Databases stay open for all clients to share
 * - Databases are only closed when the server stops
 *
 * When data is mutated, the server broadcasts sync messages to all other
 * clients so they can update their local state.
 *
 * @example
 * const server = new IDBProxyServer({
 *   transport: createChromeExtensionServerTransport(),
 *   onDatabaseInit: async (dbName) => {
 *     await migrateIndexedDBWithFunctions(dbName, migrations);
 *   }
 * });
 * server.start();
 */
export class IDBProxyServer {
	private databases: Map<string, IDBDatabaseLike> = new Map();
	private pendingDatabases: Map<string, Promise<void>> = new Map();
	private dbCreator: IDBCreator;
	private debug: boolean;

	constructor(private options: IDBProxyServerOptions) {
		this.dbCreator = options.dbCreator ?? defaultIDBCreator;
		this.debug = options.debug ?? false;
	}

	/**
	 * Start listening for requests from clients
	 */
	start(): void {
		this.options.transport.onRequest(async (request) => {
			return this.handleRequest(request);
		});

		if (this.debug) {
			console.log("[IDBProxyServer] Started");
		}
	}

	/**
	 * Stop the server and close all databases
	 */
	stop(): void {
		for (const [name, db] of this.databases.entries()) {
			db.close();
			if (this.debug) {
				console.log(`[IDBProxyServer] Closed database "${name}"`);
			}
		}
		this.databases.clear();
		this.options.transport.dispose?.();

		if (this.debug) {
			console.log("[IDBProxyServer] Stopped");
		}
	}

	/**
	 * Handle an incoming request from a client
	 */
	private async handleRequest(
		request: IDBProxyRequest,
	): Promise<IDBProxyResponse> {
		if (this.debug) {
			console.log(
				"[IDBProxyServer] Request:",
				request.type,
				request.dbName,
				"from",
				request.clientId,
			);
		}

		try {
			const result = await this.processRequest(request);
			return { id: request.id, type: "success", data: result };
		} catch (error) {
			let errorMessage: string;
			if (error instanceof Error) {
				errorMessage = error.message || error.name || "Unknown error";
				console.error("[IDBProxyServer] Error:", error.stack || error);
			} else {
				errorMessage = String(error) || "Unknown error";
				console.error("[IDBProxyServer] Error:", error);
			}
			return { id: request.id, type: "error", error: errorMessage };
		}
	}

	/**
	 * Process a request and return the result
	 */
	private async processRequest(request: IDBProxyRequest): Promise<unknown> {
		switch (request.type) {
			case "connect":
				await this.ensureDatabase(request.dbName);
				return { connected: true };

			case "disconnect":
				return { disconnected: true };

			case "getVersion":
				return (await this.getDatabase(request.dbName)).version;

			case "hasStore":
				return (await this.getDatabase(request.dbName)).hasStore(
					request.storeName,
				);

			case "getStoreNames":
				return (await this.getDatabase(request.dbName)).getStoreNames();

			case "getStoreIndexes":
				return (await this.getDatabase(request.dbName)).getStoreIndexes(
					request.storeName,
				);

			case "getAll":
				return (await this.getDatabase(request.dbName)).getAll(
					request.storeName,
				);

			case "getAllByIndex":
				return (await this.getDatabase(request.dbName)).getAllByIndex(
					request.storeName,
					request.indexName,
					request.keyRange,
				);

			case "get":
				return (await this.getDatabase(request.dbName)).get(
					request.storeName,
					request.key,
				);

			case "add": {
				const db = await this.getDatabase(request.dbName);
				await db.add(request.storeName, request.items);
				// Broadcast to other clients
				this.options.transport.broadcast(
					{
						type: "sync:add",
						dbName: request.dbName,
						storeName: request.storeName,
						items: request.items,
					},
					request.clientId,
				);
				return undefined;
			}

			case "put": {
				const db = await this.getDatabase(request.dbName);
				await db.put(request.storeName, request.items);
				// Broadcast to other clients
				this.options.transport.broadcast(
					{
						type: "sync:put",
						dbName: request.dbName,
						storeName: request.storeName,
						items: request.items,
					},
					request.clientId,
				);
				return undefined;
			}

			case "delete": {
				const db = await this.getDatabase(request.dbName);
				await db.delete(request.storeName, request.keys);
				// Broadcast to other clients
				this.options.transport.broadcast(
					{
						type: "sync:delete",
						dbName: request.dbName,
						storeName: request.storeName,
						keys: request.keys,
					},
					request.clientId,
				);
				return undefined;
			}

			case "clear": {
				const db = await this.getDatabase(request.dbName);
				await db.clear(request.storeName);
				// Broadcast to other clients
				this.options.transport.broadcast(
					{
						type: "sync:truncate",
						dbName: request.dbName,
						storeName: request.storeName,
					},
					request.clientId,
				);
				return undefined;
			}

			default:
				throw new Error(
					`Unknown request type: ${(request as { type: string }).type}`,
				);
		}
	}

	/**
	 * Get a database, opening it if needed
	 */
	private async getDatabase(dbName: string): Promise<IDBDatabaseLike> {
		await this.ensureDatabase(dbName);
		// biome-ignore lint/style/noNonNullAssertion: ensureDatabase guarantees it exists
		return this.databases.get(dbName)!;
	}

	/**
	 * Ensure a database is open and initialized.
	 * Handles concurrent connection requests by having them wait for the same promise.
	 */
	private async ensureDatabase(dbName: string): Promise<void> {
		// Already open
		if (this.databases.has(dbName)) {
			return;
		}

		// Currently being opened - wait for it
		const pending = this.pendingDatabases.get(dbName);
		if (pending) {
			await pending;
			return;
		}

		// Start opening
		if (this.debug) {
			console.log(`[IDBProxyServer] Opening database "${dbName}"`);
		}

		const openPromise = (async () => {
			const db = await this.dbCreator(dbName);

			if (!db) {
				throw new Error(
					`dbCreator returned null/undefined for database "${dbName}"`,
				);
			}

			this.databases.set(dbName, db);

			if (this.options.onDatabaseInit) {
				await this.options.onDatabaseInit(dbName, db);
			}

			if (this.debug) {
				console.log(`[IDBProxyServer] Database "${dbName}" ready`);
			}
		})();

		this.pendingDatabases.set(dbName, openPromise);

		try {
			await openPromise;
		} finally {
			this.pendingDatabases.delete(dbName);
		}
	}
}

/**
 * Convenience function to create and start a proxy server
 */
export function createProxyServer(
	options: IDBProxyServerOptions,
): IDBProxyServer {
	const server = new IDBProxyServer(options);
	server.start();
	return server;
}
