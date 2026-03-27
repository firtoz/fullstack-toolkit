import { syncableTable } from "@firtoz/drizzle-utils";
import { integer, text } from "drizzle-orm/sqlite-core";

export const todosTable = syncableTable("todos", {
	title: text("title").notNull(),
	completed: integer("completed", { mode: "boolean" }).notNull().default(false),
});
