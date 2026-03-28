---
"@firtoz/collection-sync": minor
---

Fix infinite re-renders in `usePartialSyncWindow`: keep a stable `PartialSyncClientBridge` and route `receiveSync` / cache eviction through refs, and stop listing `serializeJson` / `deserializeJson` as WebSocket layout-effect dependencies (inline serializers retriggered connect/cleanup every render and toggled bridge connection state in a loop).

Scroll-settled seeks: optional `lastVisibleIndex` is used for the dense-window short-circuit when present; `PeopleVirtualList` uses **`max(geoFirst, virtualFirst)`** in the list interior but **`geoFirst` only near the scroll top** (sudden jumps can leave a high virtual first index while `scrollTop` is already 0). Settled indices also refresh `onViewportChange`. `windowStartRef` updates synchronously when a seek applies a new window.

**Live scroll:** `seekToViewport(..., { scrollSettled: false })` now realigns the dense window whenever the **first visible row index** is outside `[windowStart, windowStart + rows.length)` (throttled by `seekCooldownMs`), not only when scrolling past the end with a row gap — so the virtualizer does not show cached indices before React state catches up. Removed unused `seekRowGap` option from `usePartialSyncWindow`.

**Breaking:** `usePartialSyncWindow` replaces `loading` with `rangeRequestInFlight` (true only while awaiting `requestRangeQuery` on the server). Cache-only window moves no longer set it.

Add **`getRowSlot(globalIndex)`** returning `{ row, slot }` with `PartialSyncRowSlot`: **`ready`** (in dense window) / **`ready_global`** (cached in collection, dense window not there yet) / **`stale_map`** / **`server`** (global index inside the in-flight range request) / **`none`**. Tracks **`pendingServerRange`** so only indices covered by the active fetch classify as **`server`**, not every placeholder while an unrelated range loads. The partial-sync example shows the slot per row for debugging.
