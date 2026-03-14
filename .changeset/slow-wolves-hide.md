---
"@firtoz/drizzle-indexeddb": major
---

BREAKING: Renamed Drizzle-specific exports with `Drizzle` prefix for clarity. `indexedDBCollectionOptions` → `drizzleIndexedDBCollectionOptions`, `IndexedDBCollectionConfig` → `DrizzleIndexedDBCollectionConfig`, `IndexedDBSyncItem` → `DrizzleIndexedDBSyncItem`. Removed `KeyRangeSpec` re-export (import from `@firtoz/idb-collections` instead). `tryExtractIndexedQuery` moved to `@firtoz/idb-collections`.
