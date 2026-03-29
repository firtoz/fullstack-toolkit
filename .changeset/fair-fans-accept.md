---
"@firtoz/drizzle-sqlite-wasm": minor
---

Add optional `workerOpenOptions` (`synchronous`, `journalMode` PRAGMAs) on worker `Start`, `SqliteWorkerManager.getDbInstance`, `useDrizzleSqliteDb`, and `DrizzleSqliteProvider`. Export `SqliteWasmWorkerOpenOptions` and Zod schemas. Defaults unchanged (`FULL` + `WAL`).
