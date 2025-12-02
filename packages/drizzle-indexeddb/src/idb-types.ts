/**
 * Index information returned by getStoreIndexes
 */
export interface IndexInfo {
	name: string;
	keyPath: string | string[];
}

/**
 * Options for creating an object store
 */
export interface CreateStoreOptions {
	keyPath?: string;
	autoIncrement?: boolean;
}

/**
 * Options for creating an index
 */
export interface CreateIndexOptions {
	unique?: boolean;
}

/**
 * Key range specification for index queries
 */
export interface KeyRangeSpec {
	type: "only" | "lowerBound" | "upperBound" | "bound";
	value?: unknown;
	lower?: unknown;
	upper?: unknown;
	lowerOpen?: boolean;
	upperOpen?: boolean;
}

/**
 * Minimal database interface with high-level async operations.
 * This is the interface that custom implementations (mocks, Chrome extension proxies, etc.) need to implement.
 *
 * All operations are simple async functions - no transactions, requests, or callbacks to deal with.
 */
export interface IDBDatabaseLike {
	/** Database version number */
	readonly version: number;

	// =========================================================================
	// Schema Operations (for migrations)
	// =========================================================================

	/** Check if a store exists */
	hasStore(storeName: string): boolean;

	/** Get list of all store names */
	getStoreNames(): string[];

	/** Create an object store (only valid during migrations) */
	createStore(storeName: string, options?: CreateStoreOptions): void;

	/** Delete an object store (only valid during migrations) */
	deleteStore(storeName: string): void;

	/** Create an index on a store (only valid during migrations) */
	createIndex(
		storeName: string,
		indexName: string,
		keyPath: string | string[],
		options?: CreateIndexOptions,
	): void;

	/** Delete an index from a store (only valid during migrations) */
	deleteIndex(storeName: string, indexName: string): void;

	/** Get all indexes for a store (for index discovery) */
	getStoreIndexes(storeName: string): IndexInfo[];

	// =========================================================================
	// Data Operations (all async, handle transactions internally)
	// =========================================================================

	/** Get all items from a store */
	getAll<T = unknown>(storeName: string): Promise<T[]>;

	/** Get items from a store using an index with optional key range */
	getAllByIndex<T = unknown>(
		storeName: string,
		indexName: string,
		keyRange?: KeyRangeSpec,
	): Promise<T[]>;

	/** Get a single item by key */
	get<T = unknown>(storeName: string, key: IDBValidKey): Promise<T | undefined>;

	/** Add items to a store (batch operation) */
	add(storeName: string, items: unknown[]): Promise<void>;

	/** Update items in a store (batch operation, uses put) */
	put(storeName: string, items: unknown[]): Promise<void>;

	/** Delete items from a store by keys (batch operation) */
	delete(storeName: string, keys: IDBValidKey[]): Promise<void>;

	/** Clear all items from a store */
	clear(storeName: string): Promise<void>;

	// =========================================================================
	// Lifecycle
	// =========================================================================

	/** Close the database connection */
	close(): void;
}

/**
 * Options for opening a database with version upgrade support.
 */
export interface IDBOpenOptions {
	/** Target version for the database. If higher than current, triggers upgrade. */
	version?: number;
	/** Called during version upgrade - this is where schema changes (createStore, createIndex) are allowed. */
	onUpgrade?: (db: IDBDatabaseLike) => void;
}

/**
 * Function type for creating/opening an IndexedDB-like database.
 * Custom implementations can use this to provide proxy/mock/alternative backends.
 */
export type IDBCreator = (
	name: string,
	options?: IDBOpenOptions,
) => Promise<IDBDatabaseLike>;

/**
 * Function type for deleting an IndexedDB database.
 */
export type IDBDeleter = (name: string) => Promise<void>;
