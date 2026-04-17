import type { Collection } from "@tanstack/db";
import type * as schema from "test-schema/schema";

type Todo = typeof schema.todoTable.$inferSelect;
type TodoId = Todo["id"];

/**
 * Base collection interface that works with both SQLite and IndexedDB implementations
 * Both collections from @tanstack/db provide these core methods with similar signatures
 *
 * This interface extends the base Collection interface and constrains it to work with both implementations
 */
export type BaseTodoCollection = Collection<
	Todo,
	TodoId,
	// biome-ignore lint/suspicious/noExplicitAny: We need to use any here to match the Collection type
	any,
	// biome-ignore lint/suspicious/noExplicitAny: We need to use any here to match the Collection type
	any,
	// biome-ignore lint/suspicious/noExplicitAny: We need to use any here to match the Collection type
	any
>;
