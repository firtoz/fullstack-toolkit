import { syncableTable } from "@firtoz/drizzle-utils";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const todosTable = syncableTable("todos", {
	title: text("title").notNull(),
	completed: integer("completed", { mode: "boolean" }).notNull().default(false),
});

/** HTTP-only virtual-props demo messages (not syncable-table / not WebSocket sync). */
export const virtualPropsMessagesTable = sqliteTable("vp_messages", {
	id: text("id").primaryKey(),
	threadId: text("thread_id").notNull(),
	body: text("body").notNull(),
});
