---
"@firtoz/drizzle-utils": minor
"@firtoz/drizzle-indexeddb": major
---

**`@firtoz/drizzle-utils`:** Export `DrizzleSqliteTableCollection`; extend `BaseSyncConfig` / `createCollectionConfig` for typed `getSyncPersistKey` and `getKey` as `IdOf<TTable>`; avoid executing `syncableTable` default functions during table definition for Worker/DO globals; export collection helper types for Drizzle-backed TanStack collections.

**`@firtoz/drizzle-indexeddb` (major):** `deferLocalPersistence`, `handleBatchPut`, and related collection options; `receiveSync` persistence aligned with generic sync and partial-sync traffic; remove debug ingest usage. **Breaking** alongside the `@firtoz/drizzle-utils` sync/collection typing changes above (including `DrizzleSqliteTableCollection` and `BaseSyncConfig` expectations).
