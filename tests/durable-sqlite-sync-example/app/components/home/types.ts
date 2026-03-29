import type { DrizzleSqliteTableCollection } from "@firtoz/drizzle-utils";
import type { InferSelectModel } from "drizzle-orm";
import type * as schema from "../../../src/schema";

/**
 * Table handle for generic collection types — same idea as `TTable` in
 * {@link DrizzleSqliteTableCollection}.
 */
export type TodosTable = typeof schema.todosTable;

/**
 * Select row for {@link TodosTable}. Matches the item type parameter of
 * {@link DrizzleSqliteTableCollection} (there written as
 * `InferSchemaOutput<SelectSchema<TTable>>`). This app uses {@link InferSelectModel} instead so
 * branded `id` columns stay correct — Valibot’s schema output widens them to a `String`-like shape.
 */
export type TodoRow = InferSelectModel<TodosTable>;

/** TanStack collection for this table (WASM or DO SQLite + shared utils). */
export type TodoSqliteCollection = DrizzleSqliteTableCollection<TodosTable>;

export type Todo = TodoRow;
export type TodoInsert = typeof schema.todosTable.$inferInsert;
export type TodoId = TodoRow["id"];

export const BACKEND_MODES = ["memory", "indexeddb", "sqlite"] as const;
export type BackendMode = (typeof BACKEND_MODES)[number];
