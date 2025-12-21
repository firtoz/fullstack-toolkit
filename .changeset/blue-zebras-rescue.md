---
"@firtoz/drizzle-sqlite-wasm": patch
---

Fix critical bug where debug mode prevented database operations from executing. Debug handlers now properly wrap and call the actual backend handlers instead of replacing them.

Add cursor-based and offset-based pagination support to `loadSubset` operations, enabling efficient navigation through large datasets.

Add `SQLInterceptor` support to log all SQL queries, including direct Drizzle queries, with the new `createInstrumentedDrizzle` function. This provides comprehensive query visibility for debugging and monitoring.

Add explicit return type `SqliteCollectionConfig<TTable>` to `sqliteCollectionOptions` function, improving type safety and eliminating the `any` cast at the return statement.

