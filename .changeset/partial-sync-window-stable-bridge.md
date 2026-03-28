---
"@firtoz/collection-sync": minor
"@firtoz/drizzle-durable-sqlite": minor
---

Fix infinite re-renders in `usePartialSyncWindow`: keep a stable `PartialSyncClientBridge` and route `receiveSync` / cache eviction through refs, and stop listing `serializeJson` / `deserializeJson` as WebSocket layout-effect dependencies (inline serializers retriggered connect/cleanup every render and toggled bridge connection state in a loop).

Scroll-settled seeks: optional `lastVisibleIndex` is used for the dense-window short-circuit when present; `PeopleVirtualList` uses **`max(geoFirst, virtualFirst)`** in the list interior but **`geoFirst` only near the scroll top** (sudden jumps can leave a high virtual first index while `scrollTop` is already 0). Settled indices also refresh `onViewportChange`. `windowStartRef` updates synchronously when a seek applies a new window.

**Live scroll:** `seekToViewport(..., { scrollSettled: false })` now realigns the dense window whenever the **first visible row index** is outside `[windowStart, windowStart + rows.length)` (throttled by `seekCooldownMs`), not only when scrolling past the end with a row gap — so the virtualizer does not show cached indices before React state catches up. Removed unused `seekRowGap` option from `usePartialSyncWindow`.

**Breaking:** `usePartialSyncWindow` replaces `loading` with `rangeRequestInFlight` (true only while awaiting `requestRangeQuery` on the server). Cache-only window moves no longer set it.

Add **`getRowSlot(globalIndex)`** returning `{ row, slot }` with `PartialSyncRowSlot`: **`ready`** (in dense window) / **`ready_global`** (cached in collection, dense window not there yet) / **`stale_map`** / **`server`** (global index inside the in-flight range request) / **`none`**. Tracks **`pendingServerRange`** so only indices covered by the active fetch classify as **`server`**, not every placeholder while an unrelated range loads. The partial-sync example shows the slot per row for debugging.

**Cache eviction:** `CacheManager.resyncSortPositionsForTrackedRows` runs after local collection changes (via `usePartialSyncWindow` `subscribeChanges`) so sort-key edits (e.g. renaming a row) do not leave stale fingerprint positions that incorrectly evict visible rows. **Viewport distance** treats `fromValue`/`toValue` as an unordered `[min,max]` band so a sort-key edit cannot invert first/last keys and make every entry look “outside” the window (mass eviction → empty list).

**Window reset:** `usePartialSyncWindow` resets the partial window on **`sort`** and optional **`partialWindowResetKey`** only — not on TanStack `collection` reference churn (which could spuriously `truncate()` and clear the index map during local edits). Pass a stable key per logical backend (e.g. `${backendLabel}-${roomId}`).

**Index map vs collection resilience:** If `receiveSync` removes rows without going through cache `deleteRows` (e.g. range deltas / server patches), the global index map could still reference missing ids. Previously this emptied the entire dense window. Now:
- **`indexRows` skips** stale map entries instead of breaking at the first hole — the UI shows 49/50 rows instead of 0.
- **`subscribeChanges`** removes individual stale map entries (no wholesale map clear or abort/force-seek cascade).
- **`seekToViewport` cooldown** applies to `scrollSettled` seeks too, preventing scroll-end events from aborting in-flight range requests.

**Partial sync + local mutations:** `SyncClientBridge` gains `sendSyncHelloOnConnect` (default `true`; set `false` with `withSync` when pairing `mutateBatch` with partial sync only). `connectPartialSync` accepts an optional `mutationBridge`; inbound `syncBatch` applies once via the mutation bridge, then `PartialSyncClientBridge.syncTrackedIdsFromMessages` updates cached ids. `usePartialSyncWindow` accepts `mutationBridge` and `mergeTransportSend`, shares `clientId` with the partial bridge when mutating, and stores range index maps with normalized keys via **`partialSyncRowKey`**. Export **`createPartialSyncedCollection`**, **`partialSyncRowKey`**, **`PartialSyncRowId`**, and **`getPartialSyncRowByMapId`** (resolve rows for index-map ids when `collection.get` disagrees with TanStack key shape). **`deleteRows`** eviction clears index-map entries when delete keys match by string or numeric string form. `PartialSyncItem` / sync row bounds accept ORM string-like ids (e.g. drizzle-sqlite-wasm) by widening `id` and normalizing to `string | number` for caches and pending-mutation maps.

**Critical fix — local `truncate` must not hit `mutateBatch`:** `withSync` wrapped `utils.truncate` so every local truncate was queued for `mutateBatch`. `usePartialSyncWindow` calls `truncate()` on sort/window reset; that pending `truncate` could batch with a user **`update`**, producing server **`ack` changes `["truncate","update"]`** — wiping the collection (and server DB) then re-applying one row. Add **`forwardTruncateToMutations`** on `WithSyncOptions` (default `true` for full sync). **`createPartialSyncedCollection`** defaults it to **`false`** so partial-sync window resets stay local-only.

**Server:** `SyncServerBridgeStore.getRow` is **async** (`Promise<TItem | undefined>`) so LWW can read the database. **`@firtoz/drizzle-durable-sqlite`:** `QueryableDurableObject` can attach a `SyncServerBridge` and route `mutateBatch` / `syncHello` to it while other messages go to `PartialSyncServerBridge`.
