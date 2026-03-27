import { syncableTable } from "@firtoz/drizzle-utils";
import { integer, text } from "drizzle-orm/sqlite-core";

export const peopleTable = syncableTable("people", {
	name: text("name").notNull(),
	age: integer("age").notNull(),
});
