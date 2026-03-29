---
"@firtoz/collection-sync": major
---

**Breaking:** Sync and partial-sync APIs require `PartialSyncRowShape` — every row must declare an `updatedAt` key (values may be `number`, `Date`, `null`, or `undefined` for “no watermark”). React peer dependency is now `>=19.2.4` (viewport hook uses `useEffectEvent`).

Add `@firtoz/collection-sync` with msgpack/Zod wire schemas (including `SyncClientMessage` / `SyncServerMessage` from schema inference), full and partial client/server bridges, `connectSync` / `connectPartialSync`, `withSync`, optional `SyncStateStorage`, `collectionId` multiplexing, predicate/range/viewport helpers, React exports (`usePartialSyncWindow`, `usePartialSyncViewport`, `usePartialSyncCollection`, etc.), range reconciliation, `rangePatch` view transitions, serialized inbound handling, mutation-bridge pairing, and fixes for cache reconciliation, chunk applies, and viewport stability.
