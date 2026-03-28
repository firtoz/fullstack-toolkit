---
"@firtoz/collection-sync": patch
---

`PartialSyncClientBridge` reconciles `queryRangeChunk` rows against ids pre-marked by `seedHydratedLocalRows`: when `collection.get` is provided and the server row is newer (or differs with the same `updatedAt`), it emits `update` instead of skipping the row. `usePartialSyncCollection` and `usePartialSyncWindow` pass `get` so switching durable backends and reconnecting no longer leaves stale cells until a full reload.
