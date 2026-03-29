---
"@firtoz/drizzle-durable-sqlite": patch
---

`QueryableDurableObject` routes mutation echoes from `SyncServerBridge` through `PartialSyncServerBridge.pushServerChanges` first (per-client interest via `rangePatch`), passing `excludeClientId` so the mutator does not receive redundant `rangePatch` (they already have optimistic apply + `ack`). Then it sends `syncBatch` with empty `changes` to other clients so `serverVersion` stays aligned without broadcasting full row payloads to sessions outside their predicate windows.
