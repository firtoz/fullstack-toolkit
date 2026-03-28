import { syncableTable } from "@firtoz/drizzle-utils";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const emojiGridTable = syncableTable(
	"emoji_grid",
	{
		x: integer("x").notNull(),
		y: integer("y").notNull(),
		emoji: text("emoji").notNull(),
		name: text("name").notNull(),
		health: integer("health").notNull(),
	},
	(table) => [index("emoji_grid_x_y_idx").on(table.x, table.y)],
);

/** Row-level changelog for partial-sync reconciliation (EmojiGridSyncDO.changesSince). */
export const emojiGridChangelogTable = sqliteTable(
	"emoji_grid_changelog",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		rowId: text("rowId").notNull(),
		operation: text("operation").notNull(),
		version: integer("version", { mode: "timestamp_ms" }).notNull(),
		payloadJson: text("payloadJson"),
	},
	(table) => [index("emoji_grid_changelog_version_idx").on(table.version)],
);

export const emojiGridSchema = {
	emojiGridTable,
	emojiGridChangelogTable,
};
