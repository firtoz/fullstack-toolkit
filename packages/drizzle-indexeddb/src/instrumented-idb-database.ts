import type {
	IDBDatabaseLike,
	IDBCreator,
	IDBOpenOptions,
	IndexInfo,
	CreateStoreOptions,
	CreateIndexOptions,
	KeyRangeSpec,
} from "./idb-types";
import type { IDBInterceptor } from "./idb-interceptor";
import { defaultIDBCreator } from "./native-idb-database";

/**
 * A database wrapper that intercepts operations and reports them to an interceptor.
 * Useful for testing to verify what IndexedDB operations are actually performed.
 */
class InstrumentedIDBDatabase implements IDBDatabaseLike {
	constructor(
		private db: IDBDatabaseLike,
		private interceptor: IDBInterceptor,
	) {}

	get version(): number {
		return this.db.version;
	}

	// Schema operations (pass through without interception)
	hasStore(storeName: string): boolean {
		return this.db.hasStore(storeName);
	}

	getStoreNames(): string[] {
		return this.db.getStoreNames();
	}

	createStore(storeName: string, options?: CreateStoreOptions): void {
		this.db.createStore(storeName, options);
	}

	deleteStore(storeName: string): void {
		this.db.deleteStore(storeName);
	}

	createIndex(
		storeName: string,
		indexName: string,
		keyPath: string | string[],
		options?: CreateIndexOptions,
	): void {
		this.db.createIndex(storeName, indexName, keyPath, options);
	}

	deleteIndex(storeName: string, indexName: string): void {
		this.db.deleteIndex(storeName, indexName);
	}

	getStoreIndexes(storeName: string): IndexInfo[] {
		return this.db.getStoreIndexes(storeName);
	}

	// Data operations (intercepted)
	async getAll<T = unknown>(storeName: string): Promise<T[]> {
		const items = await this.db.getAll<T>(storeName);

		this.interceptor.onOperation?.({
			type: "getAll",
			storeName,
			itemsReturned: items,
			itemCount: items.length,
			timestamp: Date.now(),
		});

		return items;
	}

	async getAllByIndex<T = unknown>(
		storeName: string,
		indexName: string,
		keyRange?: KeyRangeSpec,
	): Promise<T[]> {
		const items = await this.db.getAllByIndex<T>(
			storeName,
			indexName,
			keyRange,
		);

		this.interceptor.onOperation?.({
			type: "index-getAll",
			storeName,
			indexName,
			keyRange: keyRange as unknown as IDBKeyRange | undefined,
			itemsReturned: items,
			itemCount: items.length,
			timestamp: Date.now(),
		});

		return items;
	}

	async get<T = unknown>(
		storeName: string,
		key: IDBValidKey,
	): Promise<T | undefined> {
		const item = await this.db.get<T>(storeName, key);

		this.interceptor.onOperation?.({
			type: "get",
			storeName,
			key,
			itemReturned: item,
			timestamp: Date.now(),
		});

		return item;
	}

	async add(storeName: string, items: unknown[]): Promise<void> {
		await this.db.add(storeName, items);

		this.interceptor.onOperation?.({
			type: "add",
			storeName,
			items,
			itemCount: items.length,
			timestamp: Date.now(),
		});
	}

	async put(storeName: string, items: unknown[]): Promise<void> {
		await this.db.put(storeName, items);

		this.interceptor.onOperation?.({
			type: "put",
			storeName,
			items,
			itemCount: items.length,
			timestamp: Date.now(),
		});
	}

	async delete(storeName: string, keys: IDBValidKey[]): Promise<void> {
		await this.db.delete(storeName, keys);

		this.interceptor.onOperation?.({
			type: "delete",
			storeName,
			keys,
			keyCount: keys.length,
			timestamp: Date.now(),
		});
	}

	async clear(storeName: string): Promise<void> {
		await this.db.clear(storeName);

		this.interceptor.onOperation?.({
			type: "clear",
			storeName,
			timestamp: Date.now(),
		});
	}

	close(): void {
		this.db.close();
	}
}

/**
 * Creates an instrumented database creator that wraps operations with interception.
 * Use this for testing to verify what IndexedDB operations are performed.
 *
 * @example
 * const interceptor = { onOperation: (op) => console.log(op) };
 * const dbCreator = createInstrumentedDbCreator(interceptor);
 *
 * <DrizzleIndexedDBProvider dbCreator={dbCreator} ... />
 */
export function createInstrumentedDbCreator(
	interceptor: IDBInterceptor,
	baseCreator?: IDBCreator,
): IDBCreator {
	const creator = baseCreator ?? defaultIDBCreator;

	return async (name: string, options?: IDBOpenOptions) => {
		const db = await creator(name, options);
		return new InstrumentedIDBDatabase(db, interceptor);
	};
}
