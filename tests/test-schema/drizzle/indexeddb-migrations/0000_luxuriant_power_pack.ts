import type { Migration } from "@firtoz/drizzle-indexeddb";

/**
 * Migration: luxuriant power pack
 * Generated from: 0000_luxuriant_power_pack
 */
export const migrate_0000: Migration = [
	{
		"type": "createTable",
		"name": "todo",
		"keyPath": "id",
		"autoIncrement": false,
		"indexes": [
			{
				"name": "todo_user_id_index",
				"keyPath": "user_id",
				"unique": false
			},
			{
				"name": "todo_parent_id_index",
				"keyPath": "parent_id",
				"unique": false
			},
			{
				"name": "todo_completed_index",
				"keyPath": "completed",
				"unique": false
			},
			{
				"name": "todo_created_at_index",
				"keyPath": "createdAt",
				"unique": false
			},
			{
				"name": "todo_updated_at_index",
				"keyPath": "updatedAt",
				"unique": false
			},
			{
				"name": "todo_deleted_at_index",
				"keyPath": "deletedAt",
				"unique": false
			}
		]
	},
	{
		"type": "createTable",
		"name": "user",
		"keyPath": "id",
		"autoIncrement": false,
		"indexes": [
			{
				"name": "email_index",
				"keyPath": "email",
				"unique": false
			}
		]
	}
];