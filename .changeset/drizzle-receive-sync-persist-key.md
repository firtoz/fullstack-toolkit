---
"@firtoz/drizzle-utils": patch
"@firtoz/drizzle-sqlite-wasm": patch
"@firtoz/drizzle-durable-sqlite": patch
"@firtoz/drizzle-indexeddb": patch
---

`BaseSyncConfig` now extends `GenericBaseSyncConfig` with the table row type so `getSyncPersistKey` is typed correctly.

Drizzle SQLite (wasm + durable) and Drizzle IndexedDB collections pass `getSyncPersistKey` from the table `getKey` into generic sync so `receiveSync` (e.g. partial sync range traffic) persists with the correct row key, matching key-val collections.

SQLite table sync `handleInsert` uses `ON CONFLICT DO UPDATE` on `id` so replayed inserts (same row already loaded from eager `initialLoad`) do not throw and partial-sync range requests can finish.
