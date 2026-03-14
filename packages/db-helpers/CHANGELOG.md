# @firtoz/db-helpers

## 2.0.0

### Major Changes

- [`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3) Thanks [@firtoz](https://github.com/firtoz)! - BREAKING: Removed `createKeyValCollection`, `keyvalCollectionOptions`, `KeyValAdapter`, `KeyValCollectionConfig`, and `KeyValCollection` exports. These have moved to the new `@firtoz/idb-collections` package.

### Minor Changes

- [`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3) Thanks [@firtoz](https://github.com/firtoz)! - Add keyval collection (`keyvalCollectionOptions`, `createKeyValCollection`) backed by a simple `KeyValAdapter` (get/set/del/entries/clear) interface, compatible with localforage and idb-keyval. Uses StandardSchemaV1 for schema definition instead of Drizzle tables.

  Also exports generic sync infrastructure (`GenericSyncBackend`, `createGenericSyncFunction`, `createGenericCollectionConfig`) and IR expression evaluator (`evaluateExpression`, `getExpressionValue`) that were previously Drizzle-only or embedded in drizzle-indexeddb.

## 1.0.0

### Major Changes

- [`3c7ce1d`](https://github.com/firtoz/fullstack-toolkit/commit/3c7ce1dbca5c5396386db9927ae7f5e19a562cf6) Thanks [@firtoz](https://github.com/firtoz)! - **Unified collection sync**

  Memory collection uses `SyncMessage` and `receiveSync`; `receiveChanges` renamed to `receiveSync`; `onBroadcast` is typed as `SyncMessage[]`; `MemorySyncWriteMessage` removed.

  **Upgrade:** Use `SyncMessage` and `utils.receiveSync(messages)` instead of `receiveChanges` / `MemorySyncWriteMessage`. Import `SyncMessage` from `@firtoz/db-helpers` (or re-exported from `@firtoz/drizzle-utils`). Type `onBroadcast` callbacks as `(messages: SyncMessage<YourItem>[]) => void`. Map your existing write shapes to `SyncMessage` (insert/update/delete/truncate) and call `receiveSync` with that array.

  **Generic sync types:** `SyncMessage`, `CollectionUtils`, `ExternalSyncEvent`, and `ExternalSyncHandler` now live in `@firtoz/db-helpers` as the single generic DB/sync package. `@firtoz/drizzle-utils` re-exports them for backward compatibility; prefer importing from `@firtoz/db-helpers` for new code.

## 0.1.0

### Minor Changes

- [`eff2cac`](https://github.com/firtoz/fullstack-toolkit/commit/eff2cac6fcd399f1091d7f9622e24af0f66d39a6) Thanks [@firtoz](https://github.com/firtoz)! - Add new `@firtoz/db-helpers` package with TanStack DB utilities. Includes in-memory collection helpers: `createMemoryCollection`, `memoryCollectionOptions`, and `MemoryCollection` type for tests and ephemeral state. TypeScript-only, no build step.
