/**
 * Migration: luxuriant power pack
 * Generated from: 0000_luxuriant_power_pack
 */
export async function migrate_0000(
	db: IDBDatabase,
): Promise<void> {
	// Create new table: todo
	if (!db.objectStoreNames.contains("todo")) {
		const store = db.createObjectStore("todo", {
			keyPath: "id",
			autoIncrement: false,
		});
		store.createIndex("todo_user_id_index", "user_id", { unique: false });
		store.createIndex("todo_parent_id_index", "parent_id", { unique: false });
		store.createIndex("todo_completed_index", "completed", { unique: false });
		store.createIndex("todo_created_at_index", "createdAt", { unique: false });
		store.createIndex("todo_updated_at_index", "updatedAt", { unique: false });
		store.createIndex("todo_deleted_at_index", "deletedAt", { unique: false });
	}

	// Create new table: user
	if (!db.objectStoreNames.contains("user")) {
		const store = db.createObjectStore("user", {
			keyPath: "id",
			autoIncrement: false,
		});
		store.createIndex("email_index", "email", { unique: false });
	}

}