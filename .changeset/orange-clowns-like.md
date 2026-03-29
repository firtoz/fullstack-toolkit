---
"@firtoz/collection-sync": minor
"@firtoz/db-helpers": minor
"@firtoz/drizzle-indexeddb": minor
---

**Inbound pump**: single-pump `do/while` with per-job error handling; drain jobs → `await flushPendingCoalescedInboundUpdates` → loop if new work arrived. A thrown `syncWrite` (e.g. duplicate insert) no longer wedges the pump or leaves it permanently frozen.

**`receiveSync` resilience** (`generic-sync`): wrap `syncBegin` … `syncWrite` in try/catch so `syncCommit` always runs even if a message throws — prevents TanStack from being left in a stuck open-transaction state.

**`SyncClientBridge.setRowGet`**: coerce server `insert` to `update` when the row already exists locally (wired from `createPartialSyncedCollection` / `createSyncedCollection`).

**Coalesced `rangePatch`**: refresh `previousValue` from `collection.get` when flushing merged server revisions. On `visibilitychange` → visible, flush deferred coalesce buffer and re-issue predicate `rangeQuery`.

**Deferred local persistence** (`@firtoz/db-helpers`): optional `deferLocalPersistence` on `GenericBaseSyncConfig` — local `onInsert`/`onUpdate`/`onDelete` apply TanStack sync immediately and enqueue durable writes (coalesced, flushed on an interval). `receiveSync`, `loadSubset`, and `truncate` flush the queue first. Export `DeferredWriteQueue`. Optional `handleBatchPut` on `GenericSyncBackend` for batch upserts.

**`withSync`**: `bridge.onLocalMutation` runs before awaiting the base `onInsert`/`onUpdate`/`onDelete` so the transport sees mutations before IndexedDB/SQLite work. Optional `localMutationThrottleMs` debounces batched local mutations (truncate flushes pending immediately).

**Drizzle IndexedDB**: `drizzleIndexedDBCollectionOptions` accepts `deferLocalPersistence`; implements `handleBatchPut` for efficient deferred flushes.

**`connectPartialSync`**: removed periodic debug ingest logging.
