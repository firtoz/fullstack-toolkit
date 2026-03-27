import type { KeyValAdapter } from "@firtoz/idb-collections";
import type { Todo } from "./types";

const INDEXEDDB_STORE_NAME = "todos";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.addEventListener("success", () => resolve(request.result));
		request.addEventListener("error", () => reject(request.error));
	});
}

export function createIndexedDbAdapter(roomId: string): {
	adapter: KeyValAdapter<Todo>;
	readyPromise: Promise<void>;
} {
	const dbName = `durable-sync-example-${roomId}`;
	const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
		const openRequest = indexedDB.open(dbName, 1);
		openRequest.addEventListener("upgradeneeded", () => {
			const db = openRequest.result;
			if (!db.objectStoreNames.contains(INDEXEDDB_STORE_NAME)) {
				db.createObjectStore(INDEXEDDB_STORE_NAME);
			}
		});
		openRequest.addEventListener("success", () => resolve(openRequest.result));
		openRequest.addEventListener("error", () => reject(openRequest.error));
	});

	const adapter: KeyValAdapter<Todo> = {
		get: async (key) => {
			const db = await dbPromise;
			const tx = db.transaction(INDEXEDDB_STORE_NAME, "readonly");
			const store = tx.objectStore(INDEXEDDB_STORE_NAME);
			return requestToPromise(store.get(key));
		},
		set: async (key, value) => {
			const db = await dbPromise;
			const tx = db.transaction(INDEXEDDB_STORE_NAME, "readwrite");
			const store = tx.objectStore(INDEXEDDB_STORE_NAME);
			await requestToPromise(store.put(value, key));
		},
		del: async (key) => {
			const db = await dbPromise;
			const tx = db.transaction(INDEXEDDB_STORE_NAME, "readwrite");
			const store = tx.objectStore(INDEXEDDB_STORE_NAME);
			await requestToPromise(store.delete(key));
		},
		entries: async () => {
			const db = await dbPromise;
			const tx = db.transaction(INDEXEDDB_STORE_NAME, "readonly");
			const store = tx.objectStore(INDEXEDDB_STORE_NAME);
			const keys = await requestToPromise(store.getAllKeys());
			const values = await requestToPromise(store.getAll());
			return keys.map((key, index) => [String(key), values[index]] as [string, Todo]);
		},
		clear: async () => {
			const db = await dbPromise;
			const tx = db.transaction(INDEXEDDB_STORE_NAME, "readwrite");
			const store = tx.objectStore(INDEXEDDB_STORE_NAME);
			await requestToPromise(store.clear());
		},
	};

	return { adapter, readyPromise: dbPromise.then(() => undefined) };
}
