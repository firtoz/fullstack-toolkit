import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";

/**
 * Drizzle Durable Object SQLite database used by partial-sync helpers.
 * (Bun/libsql drivers differ in `select` overloads; use DO SQLite in Workers.)
 */
export type PartialSyncSqliteDatabase<
	TSchema extends Record<string, unknown>,
> = DrizzleSqliteDODatabase<TSchema>;
