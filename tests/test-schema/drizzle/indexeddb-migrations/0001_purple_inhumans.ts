import type { Migration } from "@firtoz/drizzle-indexeddb";

/**
 * Migration: purple inhumans
 * Generated from: 0001_purple_inhumans
 */
export const migrate_0001: Migration = [
	{
		"type": "createIndex",
		"tableName": "todo",
		"indexName": "todo_priority_index",
		"keyPath": "priority",
		"unique": false
	},
	{
		"type": "createIndex",
		"tableName": "todo",
		"indexName": "todo_status_index",
		"keyPath": "status",
		"unique": false
	}
];