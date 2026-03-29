---
"@firtoz/collection-sync": patch
---

`usePartialSyncViewport` no longer calls `primePartialSyncBridgeCachedIdsFromCollection` before every `rangeQuery`, so `cachedCount` is not inflated to the full durable/local collection size on each debounced fetch (hydration still primes via `usePartialSyncCollection`). `rangePatch` with `viewTransition: "exitView"` now removes the row from `#cachedIds` and `serverConfirmedKeys` after apply so partial-sync counts match leaving the server-confirmed window when the server emits exit patches. `SyncServerBridge` awaits `broadcastExcept` when it returns a Promise so async mutation fan-out completes before continuing.

`connectPartialSync` coalesces inbound `rangePatch` messages per animation frame (last wins per row) when a mutation bridge is present, reducing stepped replay on observers during rapid drags; non-`rangePatch` messages flush the buffer first to preserve ordering.

`PartialSyncClientBridge` treats `rangePatch` with `enterView` as `update` (not `insert`) when `collection.get` already resolves the row, matching durable/async collections where `#cachedIds` can lag behind the live map.
