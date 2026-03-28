---
"@firtoz/collection-sync": minor
"@firtoz/drizzle-durable-sqlite": minor
---

Add optional `collectionId` to sync and partial-sync messages (default `"default"`) for multiplexing multiple logical collections on one WebSocket. Bridges tag outbound traffic and ignore mismatched inbound messages; `dispatchPartialSyncServerMessage` and `QueryableDurableObject` route by id. Export `DEFAULT_SYNC_COLLECTION_ID`, `SyncClientMessageBody`, and `SyncServerMessageBody`. `withSync` / `usePartialSyncWindow` accept `collectionId` for the mutation and partial client bridges.

Add predicate viewport helpers: `createPartialSyncAdapter`, `betweenConditionsForNumericAxes`, `usePartialSyncCollection`, `usePartialSyncViewport`, and debounce defaults `DEFAULT_VIEWPORT_RANGE_QUIET_MS` / `DEFAULT_VIEWPORT_RANGE_MAX_WAIT_MS` (also re-exported from `usePartialSyncWindow`).
