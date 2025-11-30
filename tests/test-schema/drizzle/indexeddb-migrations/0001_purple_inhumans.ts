/**
 * Migration: purple inhumans
 * Generated from: 0001_purple_inhumans
 */
export async function migrate_0001(
	db: IDBDatabase,
): Promise<void> {
	// Update indexes for table: todo
	if (db.objectStoreNames.contains("todo")) {
		const store = db.transaction("todo").objectStore("todo");

		if (!store.indexNames.contains("todo_priority_index")) {
			store.createIndex("todo_priority_index", "priority", { unique: false });
		}
		if (!store.indexNames.contains("todo_status_index")) {
			store.createIndex("todo_status_index", "status", { unique: false });
		}
	}

}