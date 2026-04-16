# @firtoz/db-helpers

## 2.2.1

### Patch Changes

- [`7c4983f`](https://github.com/firtoz/fullstack-toolkit/commit/7c4983fd27adb9709ee844547259e0f22040fded) Thanks [@firtoz](https://github.com/firtoz)! - Add `require` and `default` conditions to `package.json` `exports` so CommonJS tools (e.g. drizzle-kit) can resolve these packages under Node.

- Updated dependencies [[`7c4983f`](https://github.com/firtoz/fullstack-toolkit/commit/7c4983fd27adb9709ee844547259e0f22040fded)]:
  - @firtoz/maybe-error@1.6.1

## 2.2.0

### Minor Changes

- [`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd) Thanks [@firtoz](https://github.com/firtoz)! - Publish compiled ESM and TypeScript declarations from `dist/` for each package (`tsup`, `prepack` build). `exports`, `main`, and `types` resolve to `dist/`; CLI bins point at built JS with a Node shebang where applicable. Shared `scripts/tsup-lib.ts` discovers `src` entries and externals; workspace test apps map `@firtoz/*` to package sources in `tsconfig` for accurate generics during typecheck. `@firtoz/socka` is published under the scoped name with the same `dist/` layout.

### Patch Changes

- [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe) Thanks [@firtoz](https://github.com/firtoz)! - Improve READMEs: npm shields, contextual stack badges, clearer taglines, and new docs for `@firtoz/idb-collections` and `@firtoz/collection-sync`. Align `@firtoz/db-helpers` copy with published `dist/` builds.

- Updated dependencies [[`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd), [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe)]:
  - @firtoz/maybe-error@1.6.0

## 2.1.1

### Patch Changes

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`138c394`](https://github.com/firtoz/fullstack-toolkit/commit/138c3944b491ebf2e76b7f2c00d651fd5d788bac) Thanks [@firtoz](https://github.com/firtoz)! - Raise TanStack DB peer range to `>=0.6.3` where applicable. `createGenericCollectionConfig` now sets `defaultIndexType: BasicIndex` and `autoIndex: "eager"` so Drizzle-backed collections match pre-0.6 indexing defaults for `orderBy`/`limit` live queries. Re-enable `DeduplicatedLoadSubset` (`USE_DEDUPE`) with `@tanstack/db` 0.6.4.

## 2.1.0

### Minor Changes

- [#64](https://github.com/firtoz/fullstack-toolkit/pull/64) [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f) Thanks [@firtoz](https://github.com/firtoz)! - Harden generic TanStack sync: single-pump inbound processing with per-job error handling; wrap `receiveSync` writes so `syncCommit` always runs; serialize `receiveSync` and the sync phase of `truncate`; optional `deferLocalPersistence` with coalesced `DeferredWriteQueue` and optional `handleBatchPut` for batch upserts; optional `applyReceiveSyncDurableWrites` for one queued transaction per batch; wait for eager `initialSync` before applying remote messages; remove debug NDJSON ingest helper and call sites.

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
