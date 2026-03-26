import { syncableTable } from "@firtoz/drizzle-utils";
import { text } from "drizzle-orm/sqlite-core";

export const testItemsTable = syncableTable("test_items", {
	title: text("title").notNull(),
});
