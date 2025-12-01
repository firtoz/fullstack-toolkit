import type { IDBDatabaseLike } from "@firtoz/drizzle-indexeddb";

/**
 * Migration: luxuriant power pack
 * Generated from: 0000_luxuriant_power_pack
 */
export async function migrate_0000(
	db: IDBDatabaseLike,
): Promise<void> {
	// Create new table: todo
	if (!db.hasStore("todo")) {
		db.createStore("todo", {
			keyPath: "id",
			autoIncrement: false,
		});
		db.createIndex("todo", "todo_user_id_index", "user_id", { unique: false });
		db.createIndex("todo", "todo_parent_id_index", "parent_id", { unique: false });
		db.createIndex("todo", "todo_completed_index", "completed", { unique: false });
		db.createIndex("todo", "todo_created_at_index", "createdAt", { unique: false });
		db.createIndex("todo", "todo_updated_at_index", "updatedAt", { unique: false });
		db.createIndex("todo", "todo_deleted_at_index", "deletedAt", { unique: false });
	}

	// Create new table: user
	if (!db.hasStore("user")) {
		db.createStore("user", {
			keyPath: "id",
			autoIncrement: false,
		});
		db.createIndex("user", "email_index", "email", { unique: false });
	}

}