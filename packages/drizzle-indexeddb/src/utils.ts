export async function openIndexedDb(name: string): Promise<IDBDatabase> {
	return new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(name);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
	});
}

/**
 * Deletes the database (useful for testing)
 */
export async function deleteIndexedDB(dbName: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(dbName);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
		request.onblocked = () => {
			console.warn(
				`[IndexedDBMigrator] Delete blocked for database: ${dbName}`,
			);
		};
	});
}
