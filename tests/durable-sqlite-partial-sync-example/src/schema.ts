import { syncableTable } from "@firtoz/drizzle-utils";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const peopleTable = syncableTable("people", {
	name: text("name").notNull(),
	age: integer("age").notNull(),
});

/** Optional row-level changelog for partial-sync reconciliation (see PeopleSyncDO.changesSince). */
export const syncChangelogTable = sqliteTable("sync_changelog", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	rowId: text("rowId").notNull(),
	operation: text("operation").notNull(),
	version: integer("version", { mode: "timestamp_ms" }).notNull(),
	payloadJson: text("payloadJson"),
});
