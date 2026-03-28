---
"@firtoz/collection-sync": minor
"@firtoz/drizzle-durable-sqlite": minor
---

Add optional `collectionId` to sync and partial-sync messages (default `"default"`) for multiplexing multiple logical collections on one WebSocket. Bridges tag outbound traffic and ignore mismatched inbound messages; `dispatchPartialSyncServerMessage` and `QueryableDurableObject` route by id. Export `DEFAULT_SYNC_COLLECTION_ID`, `SyncClientMessageBody`, and `SyncServerMessageBody`. `withSync` / `usePartialSyncWindow` accept `collectionId` for the mutation and partial client bridges.
