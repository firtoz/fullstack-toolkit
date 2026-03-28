import type { KeyValAdapter } from "@firtoz/idb-collections";
import type { PersonRow } from "./types";

const INDEXEDDB_STORE_NAME = "people";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.addEventListener("success", () => resolve(request.result));
		request.addEventListener("error", () => reject(request.error));
	});
}

export function createIndexedDbAdapter(roomId: string): {
	adapter: KeyValAdapter<PersonRow>;
	readyPromise: Promise<void>;
} {
	const dbName = `durable-partial-sync-${roomId}`;
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

	const adapter: KeyValAdapter<PersonRow> = {
		get: async (key) => {
			const db = await dbPromise;
			const tx = db.transaction(INDEXEDDB_STORE_NAME, "readonly");
			return requestToPromise(tx.objectStore(INDEXEDDB_STORE_NAME).get(key));
		},
		set: async (key, value) => {
			const db = await dbPromise;
			const tx = db.transaction(INDEXEDDB_STORE_NAME, "readwrite");
			await requestToPromise(
				tx.objectStore(INDEXEDDB_STORE_NAME).put(value, key),
			);
		},
		del: async (key) => {
			const db = await dbPromise;
			const tx = db.transaction(INDEXEDDB_STORE_NAME, "readwrite");
			await requestToPromise(tx.objectStore(INDEXEDDB_STORE_NAME).delete(key));
		},
		entries: async () => {
			const db = await dbPromise;
			const tx = db.transaction(INDEXEDDB_STORE_NAME, "readonly");
			const store = tx.objectStore(INDEXEDDB_STORE_NAME);
			const keys = await requestToPromise(store.getAllKeys());
			const values = await requestToPromise(store.getAll());
			return keys.map((key, index) => [
				String(key),
				values[index] as PersonRow,
			]);
		},
		clear: async () => {
			const db = await dbPromise;
			const tx = db.transaction(INDEXEDDB_STORE_NAME, "readwrite");
			await requestToPromise(tx.objectStore(INDEXEDDB_STORE_NAME).clear());
		},
	};

	return { adapter, readyPromise: dbPromise.then(() => undefined) };
}
