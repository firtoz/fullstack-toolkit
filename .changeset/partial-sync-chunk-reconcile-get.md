---
"@firtoz/collection-sync": patch
---

`PartialSyncClientBridge` applies `queryRangeChunk` rows using `collection.get` before choosing `insert` vs `update`, so durable collections (IndexedDB, SQLite, etc.) that already hold rows but have not yet updated `#cachedIds` no longer trigger duplicate-key `receiveSync` errors. Failed chunk applies reject the in-flight range promise and exit `fetching…` state instead of leaving the UI stuck.
