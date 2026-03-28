---
"@firtoz/collection-sync": patch
---

After reload, partial-sync bridge cache counts now include rows already loaded from durable storage (e.g. IndexedDB), not only rows applied from the WebSocket.

`usePartialSyncCollection` calls `unsubscribe` on the object returned from `subscribeChanges` (not a destructured `{ unsubscribe }` reference), so TanStack’s internal `this` is preserved and teardown no longer throws (`truncateCleanup`). The hydration `useLayoutEffect` stays **before** the WebSocket one so `disconnect()` runs after that subscription is torn down.
