# @firtoz/drizzle-utils

## 1.3.4

### Patch Changes

- [`36f1d36`](https://github.com/firtoz/fullstack-toolkit/commit/36f1d369e58fe66c3b1ebc33d069cb393a1b25f5) Thanks [@firtoz](https://github.com/firtoz)! - Align peer dependency minimums with the workspace catalog: `@tanstack/db` >=0.6.14, `@tanstack/react-db` >=0.1.92, `react` >=19.2.7, and `valibot` >=1.4.2.

- Updated dependencies [[`36f1d36`](https://github.com/firtoz/fullstack-toolkit/commit/36f1d369e58fe66c3b1ebc33d069cb393a1b25f5)]:
  - @firtoz/db-helpers@2.2.4

## 1.3.3

### Patch Changes

- [`43cbf3d`](https://github.com/firtoz/fullstack-toolkit/commit/43cbf3d2210a476ab7ea83f9a51b53118cf4dbed) Thanks [@firtoz](https://github.com/firtoz)! - Align with catalog dependency updates (Hono 4.12, `@hono/zod-validator` 0.8, TanStack DB 0.6.7, React 19.2.6, Valibot 1.4.1).

  - **hono-fetcher:** Strip Zod validator 400 JSON bodies from inferred route response types so `json()` matches handler payloads again.
  - **Peer ranges:** Widen minimum `@tanstack/db`, `@tanstack/react-db`, `react`, and `valibot` versions to match the workspace catalog.

- Updated dependencies [[`43cbf3d`](https://github.com/firtoz/fullstack-toolkit/commit/43cbf3d2210a476ab7ea83f9a51b53118cf4dbed)]:
  - @firtoz/db-helpers@2.2.3

## 1.3.2

### Patch Changes

- Updated dependencies [[`1656f83`](https://github.com/firtoz/fullstack-toolkit/commit/1656f8383ef99cdf698a6660789d8e42632ea69e)]:
  - @firtoz/maybe-error@1.6.2
  - @firtoz/db-helpers@2.2.2

## 1.3.1

### Patch Changes

- [`7c4983f`](https://github.com/firtoz/fullstack-toolkit/commit/7c4983fd27adb9709ee844547259e0f22040fded) Thanks [@firtoz](https://github.com/firtoz)! - Add `require` and `default` conditions to `package.json` `exports` so CommonJS tools (e.g. drizzle-kit) can resolve these packages under Node.

- Updated dependencies [[`7c4983f`](https://github.com/firtoz/fullstack-toolkit/commit/7c4983fd27adb9709ee844547259e0f22040fded)]:
  - @firtoz/db-helpers@2.2.1
  - @firtoz/maybe-error@1.6.1

## 1.3.0

### Minor Changes

- [`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd) Thanks [@firtoz](https://github.com/firtoz)! - Publish compiled ESM and TypeScript declarations from `dist/` for each package (`tsup`, `prepack` build). `exports`, `main`, and `types` resolve to `dist/`; CLI bins point at built JS with a Node shebang where applicable. Shared `scripts/tsup-lib.ts` discovers `src` entries and externals; workspace test apps map `@firtoz/*` to package sources in `tsconfig` for accurate generics during typecheck. `@firtoz/socka` is published under the scoped name with the same `dist/` layout.

### Patch Changes

- [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe) Thanks [@firtoz](https://github.com/firtoz)! - Improve READMEs: npm shields, contextual stack badges, clearer taglines, and new docs for `@firtoz/idb-collections` and `@firtoz/collection-sync`. Align `@firtoz/db-helpers` copy with published `dist/` builds.

- Updated dependencies [[`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd), [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe)]:
  - @firtoz/db-helpers@2.2.0
  - @firtoz/maybe-error@1.6.0

## 1.2.1

### Patch Changes

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`138c394`](https://github.com/firtoz/fullstack-toolkit/commit/138c3944b491ebf2e76b7f2c00d651fd5d788bac) Thanks [@firtoz](https://github.com/firtoz)! - Raise TanStack DB peer range to `>=0.6.3` where applicable. `createGenericCollectionConfig` now sets `defaultIndexType: BasicIndex` and `autoIndex: "eager"` so Drizzle-backed collections match pre-0.6 indexing defaults for `orderBy`/`limit` live queries. Re-enable `DeduplicatedLoadSubset` (`USE_DEDUPE`) with `@tanstack/db` 0.6.4.

- Updated dependencies [[`138c394`](https://github.com/firtoz/fullstack-toolkit/commit/138c3944b491ebf2e76b7f2c00d651fd5d788bac)]:
  - @firtoz/db-helpers@2.1.1

## 1.2.0

### Minor Changes

- [#64](https://github.com/firtoz/fullstack-toolkit/pull/64) [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f) Thanks [@firtoz](https://github.com/firtoz)! - **`@firtoz/drizzle-utils`:** Export `DrizzleSqliteTableCollection`; extend `BaseSyncConfig` / `createCollectionConfig` for typed `getSyncPersistKey` and `getKey` as `IdOf<TTable>`; avoid executing `syncableTable` default functions during table definition for Worker/DO globals; export collection helper types for Drizzle-backed TanStack collections.

  **`@firtoz/drizzle-indexeddb` (major):** `deferLocalPersistence`, `handleBatchPut`, and related collection options; `receiveSync` persistence aligned with generic sync and partial-sync traffic; remove debug ingest usage. **Breaking** alongside the `@firtoz/drizzle-utils` sync/collection typing changes above (including `DrizzleSqliteTableCollection` and `BaseSyncConfig` expectations).

### Patch Changes

- Updated dependencies [[`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f)]:
  - @firtoz/db-helpers@2.1.0

## 1.1.0

### Minor Changes

- [`b714ebb`](https://github.com/firtoz/fullstack-toolkit/commit/b714ebbb62ec0e3c3aa56c4105e7499fac11d1e5) Thanks [@firtoz](https://github.com/firtoz)! - Extract shared SQLite TanStack sync backend (`createSqliteTableSyncBackend`, IR→Drizzle helpers, `SQLOperation` types) into `@firtoz/drizzle-utils`. Add `@firtoz/drizzle-durable-sqlite` for Durable Object SQLite collections (`durableSqliteCollectionOptions`). Refactor `@firtoz/drizzle-sqlite-wasm` to use the shared backend with `driverMode: "async"`. `durableSqliteCollectionOptions` accepts optional `readyPromise` (defaults to immediate readiness). README documents the class-field Hono pattern, `app.fetch(request, env)` for bindings, optional `on-demand` + `preload` vs eager + `onFirstReady`, and `honoDoFetcherWithName` without a separate exported app type. Restore JSDoc on `DrizzleSqliteCollectionConfig` (`debug`, `checkpoint`, `interceptor`) for editor tooltips. Align `createStandaloneCollection` generics with `InsertToSelectSchema` from `@firtoz/drizzle-utils`.

## 1.0.2

### Patch Changes

- [`bca3758`](https://github.com/firtoz/fullstack-toolkit/commit/bca3758ab5ad2661b950360dc35edda2680c3b4e) Thanks [@firtoz](https://github.com/firtoz)! - Bump minimum `valibot` peer dependency from `>=1.0.0` to `>=1.3.1`.

## 1.0.1

### Patch Changes

- [`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3) Thanks [@firtoz](https://github.com/firtoz)! - Refactor `SyncBackend`, `createSyncFunction`, and `createCollectionConfig` to delegate to generic (Drizzle-free) implementations from `@firtoz/db-helpers`. No public API changes.

- Updated dependencies [[`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3), [`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3)]:
  - @firtoz/db-helpers@2.0.0

## 1.0.0

### Major Changes

- [`3c7ce1d`](https://github.com/firtoz/fullstack-toolkit/commit/3c7ce1dbca5c5396386db9927ae7f5e19a562cf6) Thanks [@firtoz](https://github.com/firtoz)! - **Unified collection sync**

  `CollectionUtils` now exposes `receiveSync(messages: SyncMessage<T>[])` instead of `pushExternalSync`. Canonical sync message type is `SyncMessage<T, TKey>` (`insert` | `update` | `delete` | `truncate`). `ExternalSyncEvent` / `ExternalSyncHandler` are internal only.

  **Upgrade:** Replace `utils.pushExternalSync(events)` with `utils.receiveSync(messages)`. Import `SyncMessage` from `@firtoz/drizzle-utils` (or from `@firtoz/db-helpers`) and send per-mutation messages: `{ type: "insert", value }`, `{ type: "update", value, previousValue }`, `{ type: "delete", key }`, or `{ type: "truncate" }`. Stop using `ExternalSyncEvent` / `ExternalSyncHandler` in your code; they are no longer part of the public API. Generic sync types (`SyncMessage`, `CollectionUtils`) are now defined in `@firtoz/db-helpers` and re-exported here for backward compatibility.

### Patch Changes

- Updated dependencies [[`3c7ce1d`](https://github.com/firtoz/fullstack-toolkit/commit/3c7ce1dbca5c5396386db9927ae7f5e19a562cf6)]:
  - @firtoz/db-helpers@1.0.0

## 0.3.3

### Patch Changes

- [`ec365af`](https://github.com/firtoz/fullstack-toolkit/commit/ec365af8c17bcd7efc2b0cf9b3bed5225b853e72) Thanks [@firtoz](https://github.com/firtoz)! - Update dependencies

## 0.3.2

### Patch Changes

- [`2725815`](https://github.com/firtoz/fullstack-toolkit/commit/27258158dd318b34b44ed77b88b2ac9b2b4b6a3d) Thanks [@firtoz](https://github.com/firtoz)! - Updated @tanstack/db peer dependency to >=0.5.23 for compatibility with latest versions

## 0.3.1

### Patch Changes

- [`8abab0a`](https://github.com/firtoz/fullstack-toolkit/commit/8abab0ae7a99320a4254cb128c0fd823726e58e0) Thanks [@firtoz](https://github.com/firtoz)! - Update peer dependencies to require `@tanstack/db >= 0.5.12` and `drizzle-orm >= 0.45.1` for compatibility with latest pagination features.

## 0.3.0

### Minor Changes

- [`46059a2`](https://github.com/firtoz/fullstack-toolkit/commit/46059a28bd0135414b9ed022ffe162a2292adae3) Thanks [@firtoz](https://github.com/firtoz)! - Add external sync support and collection truncate utilities:

  - **`ExternalSyncEvent`** / **`ExternalSyncHandler`** types for receiving sync events from external sources (e.g., proxy server)
  - **`CollectionUtils`** interface with `truncate()` method for clearing all data from a store
  - **`handleTruncate`** added to `SyncBackend` interface
  - **`pushExternalSync`** exposed on `SyncFunctionResult` for pushing external sync events to collections
  - `createSyncFunction` now returns `utils` with truncate functionality

## 0.2.0

### Minor Changes

- [`58d2cba`](https://github.com/firtoz/fullstack-toolkit/commit/58d2cbac8ea4e540b5460b7088b6b62e50357558) Thanks [@firtoz](https://github.com/firtoz)! - Add sync mode functionality for IndexedDB and SQLite collections

  - Introduced support for both eager and on-demand sync modes in Drizzle providers
  - Implemented operation tracking via interceptors to monitor database operations during queries
  - Enhanced DrizzleIndexedDBProvider and DrizzleSqliteProvider to accept interceptors for debugging and testing purposes
  - Added createInsertSchemaWithDefaults and createInsertSchemaWithIdDefault utilities for better schema management
  - Refactored collection utilities to improve data handling and consistency across collections

## 0.1.0

### Minor Changes

- [#22](https://github.com/firtoz/fullstack-toolkit/pull/22) [`05e88e7`](https://github.com/firtoz/fullstack-toolkit/commit/05e88e775f262488d1da2b579eadd560cee2eba9) Thanks [@firtoz](https://github.com/firtoz)! - Initial release of `@firtoz/drizzle-utils` - Shared utilities and types for Drizzle ORM-based packages.

  > **⚠️ Early WIP Notice:** This package is in very early development and is **not production-ready**. It is TypeScript-only and may have breaking changes. While I (the maintainer) have limited time, I'm open to PRs for features, bug fixes, or additional support (like JS builds). Please feel free to try it out and contribute! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

  ## Features

  ### Syncable Table Builder

  - **`syncableTable`** - Creates SQLite tables with automatic timestamp tracking
    - Auto-generates UUID primary keys with type branding
    - Includes `id`, `createdAt`, `updatedAt`, and `deletedAt` columns
    - Validates that default values are compatible with IndexedDB (no SQL expressions)
    - Full TypeScript type safety with branded IDs

  ### Column Helpers

  - **`idColumn`** - Branded text primary key column
  - **`createdAtColumn`** - Integer timestamp with automatic default (now)
  - **`updatedAtColumn`** - Integer timestamp with automatic default (now)
  - **`deletedAtColumn`** - Nullable integer timestamp for soft deletes

  ### Type Utilities

  - **Branded IDs** - Type-safe string IDs with table-specific branding
    - `TableId<TTableName>` - Table-specific branded ID type
    - `IdOf<TTable>` - Extract ID type from a table
    - `makeId()` - Safely create branded IDs
  - **Schema Helpers** - Type-safe Valibot schema inference
    - `SelectSchema<TTable>` - Infer select schema from table
    - `InsertSchema<TTable>` - Infer insert schema from table

  ### Migration Types

  Shared TypeScript types for Drizzle migrations across different database backends:

  - **Journal Types** - `Journal`, `JournalEntry`
  - **Schema Definition Types** - `TableDefinition`, `ColumnDefinition`, `IndexDefinition`, `ForeignKeyDefinition`, `ViewDefinition`, `EnumDefinition`, etc.
  - **Snapshot Types** - `Snapshot`, `SnapshotMeta`, `SnapshotInternal`

  These types enable consistent migration handling in both IndexedDB and SQLite WASM packages.

  ## Example

  ```typescript
  import { syncableTable, idColumn } from "@firtoz/drizzle-utils";
  import { text } from "drizzle-orm/sqlite-core";

  // Create a table with automatic timestamp tracking
  const todoTable = syncableTable("todos", {
    title: text("title").notNull(),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
  });

  // The table automatically includes:
  // - id: TableId<"todos"> (UUID primary key)
  // - createdAt: Date (auto-set on insert)
  // - updatedAt: Date (auto-set on insert/update)
  // - deletedAt: Date | null (for soft deletes)

  type Todo = typeof todoTable.$inferSelect;
  // {
  //   id: TableId<"todos">;
  //   title: string;
  //   completed: boolean;
  //   createdAt: Date;
  //   updatedAt: Date;
  //   deletedAt: Date | null;
  // }
  ```

  ## Dependencies

  - `drizzle-orm` (peer dependency)
  - `drizzle-valibot` (peer dependency)
