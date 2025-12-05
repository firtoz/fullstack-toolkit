import type {
	IDBDatabaseLike,
	IDBCreator,
	IDBOpenOptions,
	IndexInfo,
	CreateStoreOptions,
	CreateIndexOptions,
	KeyRangeSpec,
} from "./idb-types";

/**
 * Creates a KeyRange from a KeyRangeSpec
 */
function createKeyRange(spec: KeyRangeSpec): IDBKeyRange {
	switch (spec.type) {
		case "only":
			return IDBKeyRange.only(spec.value);
		case "lowerBound":
			return IDBKeyRange.lowerBound(spec.lower, spec.lowerOpen);
		case "upperBound":
			return IDBKeyRange.upperBound(spec.upper, spec.upperOpen);
		case "bound":
			return IDBKeyRange.bound(
				spec.lower,
				spec.upper,
				spec.lowerOpen,
				spec.upperOpen,
			);
	}
}

/**
 * Default implementation that wraps native IndexedDB
 */
class NativeIDBDatabase implements IDBDatabaseLike {
	constructor(private db: IDBDatabase) {
		// Listen for version change events - close connection when another tab/process
		// wants to upgrade the database. This prevents blocking issues.
		this.db.onversionchange = () => {
			this.db.close();
		};
	}

	get version(): number {
		return this.db.version;
	}

	hasStore(storeName: string): boolean {
		return this.db.objectStoreNames.contains(storeName);
	}

	getStoreNames(): string[] {
		return Array.from(this.db.objectStoreNames);
	}

	createStore(storeName: string, options?: CreateStoreOptions): void {
		this.db.createObjectStore(storeName, options);
	}

	deleteStore(storeName: string): void {
		this.db.deleteObjectStore(storeName);
	}

	createIndex(
		storeName: string,
		indexName: string,
		keyPath: string | string[],
		options?: CreateIndexOptions,
	): void {
		const transaction = this.db.transaction(storeName, "readonly");
		const store = transaction.objectStore(storeName);
		store.createIndex(indexName, keyPath, options);
	}

	deleteIndex(storeName: string, indexName: string): void {
		const transaction = this.db.transaction(storeName, "readonly");
		const store = transaction.objectStore(storeName);
		store.deleteIndex(indexName);
	}

	getStoreIndexes(storeName: string): IndexInfo[] {
		if (!this.hasStore(storeName)) {
			return [];
		}

		const transaction = this.db.transaction(storeName, "readonly");
		const store = transaction.objectStore(storeName);
		const indexes: IndexInfo[] = [];

		for (const indexName of Array.from(store.indexNames)) {
			const index = store.index(indexName);
			indexes.push({
				name: indexName,
				keyPath: index.keyPath,
			});
		}

		return indexes;
	}

	async getAll<T = unknown>(storeName: string): Promise<T[]> {
		if (!this.hasStore(storeName)) {
			return [];
		}

		return new Promise((resolve, reject) => {
			try {
				const transaction = this.db.transaction(storeName, "readonly");
				const store = transaction.objectStore(storeName);
				const request = store.getAll();

				request.onsuccess = () => resolve(request.result as T[]);
				request.onerror = () => reject(request.error);
			} catch (error) {
				console.error("Error getting all items", error);
				reject(error);
			}
		});
	}

	async getAllByIndex<T = unknown>(
		storeName: string,
		indexName: string,
		keyRange?: KeyRangeSpec,
	): Promise<T[]> {
		return new Promise((resolve, reject) => {
			try {
				const transaction = this.db.transaction(storeName, "readonly");
				const store = transaction.objectStore(storeName);
				const index = store.index(indexName);
				const range = keyRange ? createKeyRange(keyRange) : undefined;
				const request = index.getAll(range);

				request.onsuccess = () => resolve(request.result as T[]);
				request.onerror = () => reject(request.error);
			} catch (error) {
				console.error("Error getting all items by index", error);
				reject(error);
			}
		});
	}

	async get<T = unknown>(
		storeName: string,
		key: IDBValidKey,
	): Promise<T | undefined> {
		return new Promise((resolve, reject) => {
			try {
				const transaction = this.db.transaction(storeName, "readonly");
				const store = transaction.objectStore(storeName);
				const request = store.get(key);

				request.onsuccess = () => resolve(request.result as T | undefined);
				request.onerror = () => reject(request.error);
			} catch (error) {
				console.error("Error getting item", error);
				reject(error);
			}
		});
	}

	async add(storeName: string, items: unknown[]): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				const transaction = this.db.transaction(storeName, "readwrite");
				const store = transaction.objectStore(storeName);

				for (const item of items) {
					store.add(item);
				}

				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
				transaction.onabort = () => reject(new Error("Transaction aborted"));
			} catch (error) {
				console.error("Error adding items", error);
				reject(error);
			}
		});
	}

	async put(storeName: string, items: unknown[]): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				const transaction = this.db.transaction(storeName, "readwrite");
				const store = transaction.objectStore(storeName);

				for (const item of items) {
					store.put(item);
				}

				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
				transaction.onabort = () => reject(new Error("Transaction aborted"));
			} catch (error) {
				console.error("Error putting items", error);
				reject(error);
			}
		});
	}

	async delete(storeName: string, keys: IDBValidKey[]): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				const transaction = this.db.transaction(storeName, "readwrite");
				const store = transaction.objectStore(storeName);

				for (const key of keys) {
					store.delete(key);
				}

				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
				transaction.onabort = () => reject(new Error("Transaction aborted"));
			} catch (error) {
				console.error("Error deleting items", error);
				reject(error);
			}
		});
	}

	async clear(storeName: string): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				const transaction = this.db.transaction(storeName, "readwrite");
				const store = transaction.objectStore(storeName);
				const request = store.clear();

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			} catch (error) {
				console.error("Error clearing store", error);
				reject(error);
			}
		});
	}

	close(): void {
		console.log("Closing database");
		this.db.close();
	}
}

/**
 * Upgrade-mode database wrapper used during version changes.
 * Provides IDBDatabaseLike interface with schema modification capabilities.
 */
class UpgradeModeDatabase implements IDBDatabaseLike {
	private createdStores: Map<string, IDBObjectStore> = new Map();

	constructor(
		private db: IDBDatabase,
		private transaction: IDBTransaction,
	) {}

	get version(): number {
		return this.db.version;
	}

	hasStore(storeName: string): boolean {
		return this.db.objectStoreNames.contains(storeName);
	}

	getStoreNames(): string[] {
		return Array.from(this.db.objectStoreNames);
	}

	createStore(storeName: string, options?: CreateStoreOptions): void {
		const store = this.db.createObjectStore(storeName, options);
		this.createdStores.set(storeName, store);
	}

	deleteStore(storeName: string): void {
		this.db.deleteObjectStore(storeName);
		this.createdStores.delete(storeName);
	}

	createIndex(
		storeName: string,
		indexName: string,
		keyPath: string | string[],
		options?: CreateIndexOptions,
	): void {
		let store = this.createdStores.get(storeName);
		if (!store) {
			try {
				store = this.transaction.objectStore(storeName);
			} catch {
				throw new Error(`Cannot create index - store "${storeName}" not found`);
			}
		}
		store.createIndex(indexName, keyPath, options);
	}

	deleteIndex(storeName: string, indexName: string): void {
		let store = this.createdStores.get(storeName);
		if (!store) {
			try {
				store = this.transaction.objectStore(storeName);
			} catch {
				throw new Error(`Cannot delete index - store "${storeName}" not found`);
			}
		}
		store.deleteIndex(indexName);
	}

	getStoreIndexes(storeName: string): IndexInfo[] {
		if (!this.hasStore(storeName)) return [];
		let store = this.createdStores.get(storeName);
		if (!store) {
			try {
				store = this.transaction.objectStore(storeName);
			} catch {
				return [];
			}
		}
		return Array.from(store.indexNames).map((name) => ({
			name,
			keyPath: store.index(name).keyPath,
		}));
	}

	// Data operations not available during upgrade
	async getAll<T = unknown>(): Promise<T[]> {
		throw new Error("getAll not available during upgrade");
	}
	async getAllByIndex<T = unknown>(): Promise<T[]> {
		throw new Error("getAllByIndex not available during upgrade");
	}
	async get<T = unknown>(): Promise<T | undefined> {
		throw new Error("get not available during upgrade");
	}
	async add(): Promise<void> {
		throw new Error("add not available during upgrade");
	}
	async put(): Promise<void> {
		throw new Error("put not available during upgrade");
	}
	async delete(): Promise<void> {
		throw new Error("delete not available during upgrade");
	}
	async clear(): Promise<void> {
		throw new Error("clear not available during upgrade");
	}
	close(): void {
		this.db.close();
	}
}

/**
 * Default IDB creator that uses the native IndexedDB API.
 */
export const defaultIDBCreator: IDBCreator = (
	name: string,
	options?: IDBOpenOptions,
): Promise<IDBDatabaseLike> => {
	return new Promise((resolve, reject) => {
		try {
			const request = options?.version
				? indexedDB.open(name, options.version)
				: indexedDB.open(name);

			request.onerror = () => reject(request.error);

			request.onblocked = () => {
				setTimeout(() => {
					reject(new Error("Database upgrade blocked - close other tabs"));
				}, 3000);
			};

			request.onupgradeneeded = (event) => {
				if (options?.onUpgrade) {
					const db = request.result;
					const transaction = (event.target as IDBOpenDBRequest).transaction;
					if (!transaction) {
						reject(new Error("No transaction during upgrade"));
						return;
					}
					// Create an upgrade-mode database wrapper
					const upgradeDb = new UpgradeModeDatabase(db, transaction);
					try {
						options.onUpgrade(upgradeDb);
					} catch (error) {
						transaction.abort();
						reject(error);
					}
				}
			};

			request.onsuccess = () => resolve(new NativeIDBDatabase(request.result));
		} catch (error) {
			console.error("Error creating database", error);
			reject(error);
		}
	});
};
