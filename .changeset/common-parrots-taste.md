---
"@firtoz/collection-sync": minor
"@firtoz/db-helpers": patch
---

Add `alwaysIncludeRowIds` to `usePredicateFilteredRows` and `usePartialSyncViewport`: union pinned row ids with predicate-matched rows so items stay visible outside the viewport (e.g. while dragging).

Serialize inbound WebSocket handling in `connectPartialSync` so `receiveSync` never runs concurrently, fixing TanStack DB `SyncTransactionAlreadyCommittedWriteError` and out-of-order applies under rapid `ack`/`syncBatch` bursts.

Serialize `utils.receiveSync` and the sync-phase of `utils.truncate` in `createGenericSyncFunction` so partial-sync + mutation-bridge + concurrent callers cannot share one TanStack sync transaction (fixes remaining `SyncTransactionAlreadyCommittedWriteError`).
