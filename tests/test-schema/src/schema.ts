import { type IdOf, type TableId, syncableTable } from "@firtoz/drizzle-utils";
import { relations } from "drizzle-orm";
import { index, integer, text } from "drizzle-orm/sqlite-core";

export const userTable = syncableTable(
	"user",
	{
		username: text("username").notNull(),
		email: text("email").notNull(),
	},
	(t) => [index("email_index").on(t.email)],
);

export const todoTable = syncableTable(
	"todo",
	{
		title: text("title").notNull(),
		completed: integer("completed", { mode: "boolean" })
			.notNull()
			.default(false),
		parentId: integer("parent_id").$type<TableId<"todo">>(),
		userId: integer("user_id").$type<IdOf<typeof userTable>>(),
		// Fields for comprehensive expression testing
		content: text("content"), // For LIKE/ILIKE queries
		priority: integer("priority"), // For range queries (gt, gte, lt, lte) and IN queries
		status: text("status"), // For eq/ne and IN queries
		tags: text("tags"), // For LIKE pattern matching
	},
	(t) => [
		index("todo_user_id_index").on(t.userId),
		index("todo_parent_id_index").on(t.parentId),
		index("todo_completed_index").on(t.completed),
		index("todo_created_at_index").on(t.createdAt),
		index("todo_updated_at_index").on(t.updatedAt),
		index("todo_deleted_at_index").on(t.deletedAt),
		// New indexes for testing index hits vs on-demand evaluation
		index("todo_priority_index").on(t.priority),
		index("todo_status_index").on(t.status),
	],
);

export const todoTableRelations = relations(todoTable, ({ one }) => ({
	parent: one(todoTable, {
		fields: [todoTable.parentId],
		references: [todoTable.id],
	}),
	user: one(userTable, {
		fields: [todoTable.userId],
		references: [userTable.id],
	}),
}));

export type Todo = typeof todoTable.$inferSelect;
export type InsertTodo = typeof todoTable.$inferInsert;

export type User = typeof userTable.$inferSelect;
export type InsertUser = typeof userTable.$inferInsert;
