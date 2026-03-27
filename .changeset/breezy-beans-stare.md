---
"@firtoz/collection-sync": patch
"@firtoz/db-helpers": patch
"@firtoz/drizzle-durable-sqlite": patch
---

`connectPartialSync`: queue outbound messages until the WebSocket is open so sends never run in CONNECTING state.

`PartialSyncServerBridge`: `queryRangeChunk.hasMore` reflects pagination (full page and `totalDelivered < totalCount`), not only “more chunks in this stream”.

`PartialSyncClientBridge`: `abortRangeRequests()` to cancel in-flight `queryRange` / `queryByOffset` (used when seeking / resetting).

`PartialSyncClientBridge`: `clearTrackedRowIds()` after local collection truncate; skip `receiveSync` inserts for row ids already in the bridge cache (overlapping chunks). Example app virtual list can seek while a fetch is in flight and uses a large scroll-gap shortcut so fast scroll does not wait on sequential pages.

Partial sync protocol: `queryByOffset` client message and `PartialSyncClientBridge.requestByOffset()` so clients can jump by row index without mirroring server sort-key logic; responses still use `queryRangeChunk` with `lastCursor` for subsequent cursor-based `queryRange` pages.

`QueryableDurableObject`: abstract `queryByOffset` on the store (OFFSET/LIMIT in app code).

`QueryableDurableObject`: queue client WS messages until `PartialSyncServerBridge` is constructed (fixes races with `blockConcurrencyWhile` / HMR).

`memoryCollectionOptions`: before TanStack invokes `sync`, `truncate` is a no-op and `receiveSync` batches are queued until `sync` runs (avoids races with remote WS).

`QueryableDurableObject`: add `seedInBackground` so expensive seeding does not block startup/websocket upgrades.
