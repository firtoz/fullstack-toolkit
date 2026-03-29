import z from "zod";

/**
 * SQLite `PRAGMA synchronous` levels (see SQLite docs). Default worker behavior
 * remains `FULL` for maximum durability with OPFS; `NORMAL` is often much faster
 * for interactive UIs at the cost of a narrower crash window.
 */
export const SqliteWasmSynchronousModeSchema = z.enum([
	"OFF",
	"NORMAL",
	"FULL",
	"EXTRA",
]);
export type SqliteWasmSynchronousMode = z.infer<
	typeof SqliteWasmSynchronousModeSchema
>;

/**
 * SQLite `PRAGMA journal_mode` values the worker will pass through as
 * `PRAGMA journal_mode=<value>;` (uppercase).
 */
export const SqliteWasmJournalModeSchema = z.enum([
	"WAL",
	"DELETE",
	"TRUNCATE",
	"MEMORY",
	"OFF",
]);
export type SqliteWasmJournalMode = z.infer<typeof SqliteWasmJournalModeSchema>;

/** Options applied once when the worker opens a database file (OPFS or transient). */
export const SqliteWasmWorkerOpenOptionsSchema = z
	.object({
		synchronous: SqliteWasmSynchronousModeSchema.optional(),
		journalMode: SqliteWasmJournalModeSchema.optional(),
	})
	.strict();

export type SqliteWasmWorkerOpenOptions = z.infer<
	typeof SqliteWasmWorkerOpenOptionsSchema
>;
