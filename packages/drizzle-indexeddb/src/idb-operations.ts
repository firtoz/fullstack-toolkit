import type {
	IDBDatabaseLike,
	IDBCreator,
	IDBOpenOptions,
	IDBDeleter,
} from "./idb-types";
import { defaultIDBCreator } from "./native-idb-database";

/**
 * Opens an IndexedDB database using the provided creator or the default native implementation.
 */
export async function openIndexedDb(
	name: string,
	dbCreator?: IDBCreator,
	options?: IDBOpenOptions,
): Promise<IDBDatabaseLike> {
	const dbCreatorToUse = dbCreator ?? defaultIDBCreator;
	return dbCreatorToUse(name, options);
}

/**
 * Default IDB deleter that uses the native IndexedDB API.
 */
const defaultIDBDeleter: IDBDeleter = (name: string): Promise<void> => {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
};

/**
 * Deletes an IndexedDB database (useful for testing)
 */
export async function deleteIndexedDB(
	dbName: string,
	dbDeleter?: IDBDeleter,
): Promise<void> {
	const dbDeleterToUse = dbDeleter ?? defaultIDBDeleter;
	return dbDeleterToUse(dbName);
}
