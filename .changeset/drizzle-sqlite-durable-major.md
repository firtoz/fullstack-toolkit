---
"@firtoz/drizzle-durable-sqlite": major
"@firtoz/drizzle-sqlite-wasm": major
---

**Breaking:** Shared TanStack collection row type is `DrizzleSqliteTableCollection` from `@firtoz/drizzle-utils` — remove `DrizzleSqliteCollection` / `DurableSqliteCollection` type exports from the wasm and durable packages and import from `@firtoz/drizzle-utils` instead. Align bridge/session row types with `PartialSyncRowShape`.

**`@firtoz/drizzle-durable-sqlite`:** `SyncableDurableObject` / `QueryableDurableObject`, Drizzle partial sync store (`createDrizzlePartialSyncStore`) with scoped `changesSince`, `getRow`, visibility and `rangeReconcile` hooks, `PartialSyncMutationHandler`, `applyDurableMutationIntents`, queued WS message handling, optional `seedInBackground`, and integration with `PartialSyncServerBridge` / `SyncServerBridge` as documented in the package.

**`@firtoz/drizzle-sqlite-wasm`:** `createSyncedSqliteCollection`, optional `workerOpenOptions` for worker `Start` / provider hooks, table sync upsert on `id` for replayed inserts, and receive-sync persist key alignment with generic sync.
