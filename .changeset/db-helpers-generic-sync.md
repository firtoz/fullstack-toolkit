---
"@firtoz/db-helpers": minor
---

Harden generic TanStack sync: single-pump inbound processing with per-job error handling; wrap `receiveSync` writes so `syncCommit` always runs; serialize `receiveSync` and the sync phase of `truncate`; optional `deferLocalPersistence` with coalesced `DeferredWriteQueue` and optional `handleBatchPut` for batch upserts; optional `applyReceiveSyncDurableWrites` for one queued transaction per batch; wait for eager `initialSync` before applying remote messages; remove debug NDJSON ingest helper and call sites.
