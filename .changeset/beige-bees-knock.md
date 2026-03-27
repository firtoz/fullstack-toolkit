---
"@firtoz/collection-sync": patch
"@firtoz/drizzle-utils": patch
"@firtoz/drizzle-sqlite-wasm": minor
---

Improve row-type inference for `withSync` / `createSyncedCollection` (`InferItemFromCollectionOptions`, `SyncableCollectionItem`).

Tighten `createGetKeyFunction` so `getKey` keeps branded id types.

Add `createSyncedSqliteCollection` in `@firtoz/drizzle-sqlite-wasm`, using Drizzle `InferSelectModel` for correct `$inferSelect`-aligned types when syncing SQLite collections.
