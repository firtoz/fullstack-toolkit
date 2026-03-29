---
"@firtoz/db-helpers": patch
"@firtoz/drizzle-utils": patch
---

Serialize all generic sync TanStack `begin`/`commit` paths so slow async backends (e.g. SQLite WASM) do not overlap `receiveSync` with local mutations (`SyncTransactionAlreadyCommittedWriteError`). Add optional `GenericSyncBackend.applyReceiveSyncDurableWrites` and `ReceiveSyncDurableOp`: SQLite table sync implements it so an entire `receiveSync` batch uses one queued Drizzle transaction and one optional checkpoint instead of one transaction per message (major throughput win for partial/full sync into SQLite).
