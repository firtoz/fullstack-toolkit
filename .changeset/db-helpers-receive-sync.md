---
"@firtoz/db-helpers": major
---

**Unified collection sync**

Memory collection uses `SyncMessage` and `receiveSync`; `receiveChanges` renamed to `receiveSync`; `onBroadcast` is typed as `SyncMessage[]`; `MemorySyncWriteMessage` removed.

**Upgrade:** Use `SyncMessage` and `utils.receiveSync(messages)` instead of `receiveChanges` / `MemorySyncWriteMessage`. Import `SyncMessage` from `@firtoz/db-helpers` (or re-exported from `@firtoz/drizzle-utils`). Type `onBroadcast` callbacks as `(messages: SyncMessage<YourItem>[]) => void`. Map your existing write shapes to `SyncMessage` (insert/update/delete/truncate) and call `receiveSync` with that array.

**Generic sync types:** `SyncMessage`, `CollectionUtils`, `ExternalSyncEvent`, and `ExternalSyncHandler` now live in `@firtoz/db-helpers` as the single generic DB/sync package. `@firtoz/drizzle-utils` re-exports them for backward compatibility; prefer importing from `@firtoz/db-helpers` for new code.
