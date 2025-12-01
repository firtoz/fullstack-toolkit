import type { IDBDatabaseLike } from "@firtoz/drizzle-indexeddb";

/**
 * Migration: purple inhumans
 * Generated from: 0001_purple_inhumans
 */
export async function migrate_0001(
	db: IDBDatabaseLike,
): Promise<void> {
	// Update indexes for table: todo
	if (db.hasStore("todo")) {
		db.createIndex("todo", "todo_priority_index", "priority", { unique: false });
		db.createIndex("todo", "todo_status_index", "status", { unique: false });
	}

}