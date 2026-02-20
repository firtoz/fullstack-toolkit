---
"@firtoz/drizzle-utils": major
---

**Unified collection sync**

`CollectionUtils` now exposes `receiveSync(messages: SyncMessage<T>[])` instead of `pushExternalSync`. Canonical sync message type is `SyncMessage<T, TKey>` (`insert` | `update` | `delete` | `truncate`). `ExternalSyncEvent` / `ExternalSyncHandler` are internal only.

**Upgrade:** Replace `utils.pushExternalSync(events)` with `utils.receiveSync(messages)`. Import `SyncMessage` from `@firtoz/drizzle-utils` (or from `@firtoz/db-helpers`) and send per-mutation messages: `{ type: "insert", value }`, `{ type: "update", value, previousValue }`, `{ type: "delete", key }`, or `{ type: "truncate" }`. Stop using `ExternalSyncEvent` / `ExternalSyncHandler` in your code; they are no longer part of the public API. Generic sync types (`SyncMessage`, `CollectionUtils`) are now defined in `@firtoz/db-helpers` and re-exported here for backward compatibility.
