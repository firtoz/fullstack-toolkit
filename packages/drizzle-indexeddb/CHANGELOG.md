# @firtoz/drizzle-indexeddb

## 4.0.0

### Major Changes

- [#64](https://github.com/firtoz/fullstack-toolkit/pull/64) [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f) Thanks [@firtoz](https://github.com/firtoz)! - **`@firtoz/drizzle-utils`:** Export `DrizzleSqliteTableCollection`; extend `BaseSyncConfig` / `createCollectionConfig` for typed `getSyncPersistKey` and `getKey` as `IdOf<TTable>`; avoid executing `syncableTable` default functions during table definition for Worker/DO globals; export collection helper types for Drizzle-backed TanStack collections.

  **`@firtoz/drizzle-indexeddb` (major):** `deferLocalPersistence`, `handleBatchPut`, and related collection options; `receiveSync` persistence aligned with generic sync and partial-sync traffic; remove debug ingest usage. **Breaking** alongside the `@firtoz/drizzle-utils` sync/collection typing changes above (including `DrizzleSqliteTableCollection` and `BaseSyncConfig` expectations).

### Patch Changes

- Updated dependencies [[`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f), [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f), [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f), [`f90479f`](https://github.com/firtoz/fullstack-toolkit/commit/f90479f263e932b39269aecce4f54dbbb7cdce3e)]:
  - @firtoz/db-helpers@2.1.0
  - @firtoz/drizzle-utils@1.2.0
  - @firtoz/idb-collections@0.2.2

## 3.0.1

### Patch Changes

- [`8b839f2`](https://github.com/firtoz/fullstack-toolkit/commit/8b839f2227f50409af649aab87178e039aad55dc) Thanks [@firtoz](https://github.com/firtoz)! - Export collection helper types for Drizzle-backed TanStack DB collections so users can declare collection variables with preserved select and insert inference from table schemas.

## 3.0.0

### Patch Changes

- [`b714ebb`](https://github.com/firtoz/fullstack-toolkit/commit/b714ebbb62ec0e3c3aa56c4105e7499fac11d1e5) Thanks [@firtoz](https://github.com/firtoz)! - Extract shared SQLite TanStack sync backend (`createSqliteTableSyncBackend`, IR→Drizzle helpers, `SQLOperation` types) into `@firtoz/drizzle-utils`. Add `@firtoz/drizzle-durable-sqlite` for Durable Object SQLite collections (`durableSqliteCollectionOptions`). Refactor `@firtoz/drizzle-sqlite-wasm` to use the shared backend with `driverMode: "async"`. `durableSqliteCollectionOptions` accepts optional `readyPromise` (defaults to immediate readiness). README documents the class-field Hono pattern, `app.fetch(request, env)` for bindings, optional `on-demand` + `preload` vs eager + `onFirstReady`, and `honoDoFetcherWithName` without a separate exported app type. Restore JSDoc on `DrizzleSqliteCollectionConfig` (`debug`, `checkpoint`, `interceptor`) for editor tooltips. Align `createStandaloneCollection` generics with `InsertToSelectSchema` from `@firtoz/drizzle-utils`.

- Updated dependencies [[`b714ebb`](https://github.com/firtoz/fullstack-toolkit/commit/b714ebbb62ec0e3c3aa56c4105e7499fac11d1e5)]:
  - @firtoz/drizzle-utils@1.1.0

## 2.0.1

### Patch Changes

- [`bca3758`](https://github.com/firtoz/fullstack-toolkit/commit/bca3758ab5ad2661b950360dc35edda2680c3b4e) Thanks [@firtoz](https://github.com/firtoz)! - Bump minimum `valibot` peer dependency from `>=1.0.0` to `>=1.3.1`.

- Updated dependencies [[`bca3758`](https://github.com/firtoz/fullstack-toolkit/commit/bca3758ab5ad2661b950360dc35edda2680c3b4e), [`bca3758`](https://github.com/firtoz/fullstack-toolkit/commit/bca3758ab5ad2661b950360dc35edda2680c3b4e)]:
  - @firtoz/idb-collections@0.2.1
  - @firtoz/drizzle-utils@1.0.2

## 2.0.0

### Major Changes

- [`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3) Thanks [@firtoz](https://github.com/firtoz)! - BREAKING: Renamed Drizzle-specific exports with `Drizzle` prefix for clarity. `indexedDBCollectionOptions` → `drizzleIndexedDBCollectionOptions`, `IndexedDBCollectionConfig` → `DrizzleIndexedDBCollectionConfig`, `IndexedDBSyncItem` → `DrizzleIndexedDBSyncItem`. Removed `KeyRangeSpec` re-export (import from `@firtoz/idb-collections` instead). `tryExtractIndexedQuery` moved to `@firtoz/idb-collections`.

### Patch Changes

- Updated dependencies [[`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3), [`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3), [`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3), [`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3)]:
  - @firtoz/idb-collections@0.2.0
  - @firtoz/db-helpers@2.0.0
  - @firtoz/drizzle-utils@1.0.1

## 1.0.0

### Major Changes

- [`3c7ce1d`](https://github.com/firtoz/fullstack-toolkit/commit/3c7ce1dbca5c5396386db9927ae7f5e19a562cf6) Thanks [@firtoz](https://github.com/firtoz)! - **IndexedDB proxy removed**

  The IDB proxy layer (proxy client/server, transport, sync adapter) has been removed. Provider no longer exposes proxy sync; use native IndexedDB only.

  **Upgrade:** If you were using the IDB proxy (e.g. `idb-proxy-client`, `idb-proxy-server`, `handleProxySync`, `onSyncReady`): remove that code. There is no replacement API; you implement the transport and call `receiveSync` with `SyncMessage[]` from `@firtoz/drizzle-utils` on each side.

  **Remote / multi-context setup:** Use a **memory collection** (`@firtoz/db-helpers`) in the context that cannot access IndexedDB and keep the **IDB collection** where IndexedDB is available (source of truth). Implement your own channel (e.g. BroadcastChannel, `postMessage`, or WebSocket): when a context receives sync messages, call `utils.receiveSync(messages)` on its collection. Use `SyncMessage` from `@firtoz/db-helpers` (or `@firtoz/drizzle-utils`). The side that holds IDB can push initial state and updates as `SyncMessage[]` so the other side’s memory collection stays in sync.

### Patch Changes

- Updated dependencies [[`3c7ce1d`](https://github.com/firtoz/fullstack-toolkit/commit/3c7ce1dbca5c5396386db9927ae7f5e19a562cf6), [`3c7ce1d`](https://github.com/firtoz/fullstack-toolkit/commit/3c7ce1dbca5c5396386db9927ae7f5e19a562cf6)]:
  - @firtoz/db-helpers@1.0.0
  - @firtoz/drizzle-utils@1.0.0

## 0.6.2

### Patch Changes

- [`ec365af`](https://github.com/firtoz/fullstack-toolkit/commit/ec365af8c17bcd7efc2b0cf9b3bed5225b853e72) Thanks [@firtoz](https://github.com/firtoz)! - Update dependencies

- Updated dependencies [[`ec365af`](https://github.com/firtoz/fullstack-toolkit/commit/ec365af8c17bcd7efc2b0cf9b3bed5225b853e72)]:
  - @firtoz/drizzle-utils@0.3.3

## 0.6.1

### Patch Changes

- [`2725815`](https://github.com/firtoz/fullstack-toolkit/commit/27258158dd318b34b44ed77b88b2ac9b2b4b6a3d) Thanks [@firtoz](https://github.com/firtoz)! - Updated @tanstack/db peer dependency to >=0.5.23 for compatibility with latest versions

- Updated dependencies [[`2725815`](https://github.com/firtoz/fullstack-toolkit/commit/27258158dd318b34b44ed77b88b2ac9b2b4b6a3d)]:
  - @firtoz/drizzle-utils@0.3.2

## 0.6.0

### Minor Changes

- [`a08a986`](https://github.com/firtoz/fullstack-toolkit/commit/a08a986cc5161b20c9c875328e49565c15417ffc) Thanks [@firtoz](https://github.com/firtoz)! - Slight refactor

  - Renamed `createProxyDbCreator` to `createProxyIDbCreator` for consistency across the codebase.
  - Updated server sync message type from `sync:clear` to `sync:truncate` to better reflect its functionality.
  - Adjusted related documentation and test cases to align with these changes.

## 0.5.1

### Patch Changes

- [`8abab0a`](https://github.com/firtoz/fullstack-toolkit/commit/8abab0ae7a99320a4254cb128c0fd823726e58e0) Thanks [@firtoz](https://github.com/firtoz)! - Add cursor-based and offset-based pagination support to `loadSubset` operations, enabling efficient navigation through large datasets with consistent behavior across collection backends.

- Updated dependencies [[`8abab0a`](https://github.com/firtoz/fullstack-toolkit/commit/8abab0ae7a99320a4254cb128c0fd823726e58e0)]:
  - @firtoz/drizzle-utils@0.3.1

## 0.5.0

### Minor Changes

- [`9e532bb`](https://github.com/firtoz/fullstack-toolkit/commit/9e532bbd83bc671c62fd1333ae25fd9829112464) Thanks [@firtoz](https://github.com/firtoz)! - Add `createStandaloneCollection` utility for using IndexedDB collections outside of React context.

  Features:

  - Simple API for standalone usage without React providers
  - Async mutation methods (`insert`, `update`, `delete`, `truncate`) that return Promises
  - Sync accessors (`getAll`, `get`, `isReady`)
  - Full access to collection utils (`truncate`, `pushExternalSync`)
  - Automatic database initialization with migration support

  Also:

  - Update `IndexedDbCollection` type to use `CollectionUtils` instead of generic `UtilsRecord` for proper typing of `truncate` and `pushExternalSync`
  - Export `IndexedDbCollection` type from package

### Patch Changes

- [`c772c2c`](https://github.com/firtoz/fullstack-toolkit/commit/c772c2cf74af560dc04080933591ccd3014f85a1) Thanks [@firtoz](https://github.com/firtoz)! - Improve types returned and simplify internal logic

## 0.4.3

### Patch Changes

- [`ed6dfce`](https://github.com/firtoz/fullstack-toolkit/commit/ed6dfce75be95d5349381ab43c6c22b25b164414) Thanks [@firtoz](https://github.com/firtoz)! - Enable drizzle and output dir configuration in drizzle-indexeddb-generate

## 0.4.2

### Patch Changes

- [`58afa0a`](https://github.com/firtoz/fullstack-toolkit/commit/58afa0a5365f55f536e50194a73f847293102e7f) Thanks [@firtoz](https://github.com/firtoz)! - Hopefully this should work

## 0.4.1

### Patch Changes

- [`904019f`](https://github.com/firtoz/fullstack-toolkit/commit/904019f4d04bc02521206fbe0feaeecb67e38f87) Thanks [@firtoz](https://github.com/firtoz)! - Fix tsx exporting

## 0.4.0

### Minor Changes

- [`46059a2`](https://github.com/firtoz/fullstack-toolkit/commit/46059a28bd0135414b9ed022ffe162a2292adae3) Thanks [@firtoz](https://github.com/firtoz)! - Add IDB Proxy system for multi-client IndexedDB sync over messaging layers:

  **New Proxy Module** (`@firtoz/drizzle-indexeddb/proxy`):

  - **`IDBProxyServer`** - Server that manages database lifecycle, migrations, and broadcasts mutations to connected clients
  - **`IDBProxyClient`** - Client implementing `IDBDatabaseLike`, routing operations through a transport layer
  - **`createMultiClientTransport()`** - In-memory transport for testing N clients connected to one server
  - **`createProxyIDbCreator()`** - Factory to create `dbCreator` for `DrizzleIndexedDBProvider`
  - **`createCollectionSyncHandler()`** - Adapter connecting proxy sync messages to collection's external sync

  **Real-time Multi-Client Sync**:

  - Server broadcasts `sync:add`, `sync:put`, `sync:delete`, `sync:truncate` messages to all clients (excluding initiator)
  - All mutations automatically sync across connected clients

  **Provider Enhancements**:

  - New `onSyncReady` prop for wiring up external sync handlers
  - `handleProxySync` method routes sync messages to the appropriate collection

  **Collection Truncate**:

  - `collection.utils.truncate()` clears all data and syncs to other clients
  - `handleTruncate` implemented in IndexedDB backend

  **Bug Fixes**:

  - Server handles concurrent database initialization requests (race condition fix)

### Patch Changes

- Updated dependencies [[`46059a2`](https://github.com/firtoz/fullstack-toolkit/commit/46059a28bd0135414b9ed022ffe162a2292adae3)]:
  - @firtoz/drizzle-utils@0.3.0

## 0.3.0

### Minor Changes

- [`5e854a6`](https://github.com/firtoz/fullstack-toolkit/commit/5e854a62236a811918a47037a59df23329856614) Thanks [@firtoz](https://github.com/firtoz)! - ### Breaking Changes

  - Removed `migrateIndexedDB` and `IndexedDBMigrationConfig` exports - use `migrateIndexedDBWithFunctions` instead
  - Removed snapshot-based migration system in favor of function-based migrations

  ### New Features

  - Added `drizzle-indexeddb-generate` CLI tool to generate IndexedDB migration functions from Drizzle snapshots
  - Added `generateIndexedDBMigrations` export for programmatic migration generation
  - Added `./generate` export path

  ### Migration Guide

  Instead of importing snapshots directly and using `migrateIndexedDB`, you now:

  1. Run `bun drizzle-indexeddb-generate` (or `npx drizzle-indexeddb-generate`) after `drizzle-kit generate`
  2. Import the generated migrations and use `migrateIndexedDBWithFunctions`

## 0.2.0

### Minor Changes

- [`58d2cba`](https://github.com/firtoz/fullstack-toolkit/commit/58d2cbac8ea4e540b5460b7088b6b62e50357558) Thanks [@firtoz](https://github.com/firtoz)! - Add sync mode functionality for IndexedDB and SQLite collections

  - Introduced support for both eager and on-demand sync modes in Drizzle providers
  - Implemented operation tracking via interceptors to monitor database operations during queries
  - Enhanced DrizzleIndexedDBProvider and DrizzleSqliteProvider to accept interceptors for debugging and testing purposes
  - Added createInsertSchemaWithDefaults and createInsertSchemaWithIdDefault utilities for better schema management
  - Refactored collection utilities to improve data handling and consistency across collections

### Patch Changes

- Updated dependencies [[`58d2cba`](https://github.com/firtoz/fullstack-toolkit/commit/58d2cbac8ea4e540b5460b7088b6b62e50357558)]:
  - @firtoz/drizzle-utils@0.2.0

## 0.1.0

### Minor Changes

- [#22](https://github.com/firtoz/fullstack-toolkit/pull/22) [`05e88e7`](https://github.com/firtoz/fullstack-toolkit/commit/05e88e775f262488d1da2b579eadd560cee2eba9) Thanks [@firtoz](https://github.com/firtoz)! - Initial release of `@firtoz/drizzle-indexeddb` - TanStack DB collections backed by IndexedDB with automatic migrations powered by Drizzle ORM snapshots.

  > **⚠️ Early WIP Notice:** This package is in very early development and is **not production-ready**. It is TypeScript-only and may have breaking changes. While I (the maintainer) have limited time, I'm open to PRs for features, bug fixes, or additional support (like JS builds). Please feel free to try it out and contribute! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

  **Note:** This package currently builds on top of Drizzle's SQLite integration (using `drizzle-orm/sqlite-core` types and snapshots) until Drizzle adds native IndexedDB support. The migration system reads Drizzle's SQLite snapshots and translates them into IndexedDB object stores and indexes.

  ## Features

  ### TanStack DB Collections (Primary Feature)

  **`indexedDBCollectionOptions(config)`** - The main feature: Create reactive TanStack DB collections backed by IndexedDB:

  - Full CRUD operations with type safety
  - Reactive subscriptions to data changes
  - Soft delete support (respects `deletedAt` column)
  - Automatic pagination and sorting
  - Query optimization with IndexedDB indexes
  - Sync configuration for real-time updates
  - Works seamlessly with React hooks

  ### Function-Based Migration

  **`migrateIndexedDBWithFunctions(dbName, migrations, debug?)`** - Run migrations using custom migration functions:

  - Execute custom migration logic for complex schema changes
  - Full control over IndexedDB transaction and database during migration
  - Tracks applied migrations automatically
  - Ideal for data transformations and complex schema changes

  ### React Context & Hooks

  **`DrizzleIndexedDBProvider`** - React context provider for IndexedDB:

  - Manages IndexedDB connection lifecycle
  - Provides collection access with automatic caching
  - Reference counting for memory management

  **`useDrizzleIndexedDB()`** - React hook for accessing IndexedDB context:

  - Get collection instances with type safety
  - Automatic ref counting for cleanup

  **`useIndexedDBCollection(tableName)`** - React hook for using specific collections:

  - Automatic ref counting and cleanup
  - Type-safe collection access

  ### Utilities

  **`deleteIndexedDB(dbName)`** - Utility to completely delete an IndexedDB database

  ## Example

  ```typescript
  import { migrateIndexedDBWithFunctions } from "@firtoz/drizzle-indexeddb";
  import migrations from "./drizzle/indexeddb-migrations";

  // Migrate database using function-based migrations
  const db = await migrateIndexedDBWithFunctions(
    "my-app-db",
    migrations,
    true // debug mode
  );

  // Use with TanStack DB
  import { createCollection } from "@tanstack/db";
  import { indexedDBCollectionOptions } from "@firtoz/drizzle-indexeddb";

  const todosCollection = createCollection(
    indexedDBCollectionOptions({
      db,
      tableName: "todos",
    })
  );

  // React integration
  import {
    DrizzleIndexedDBProvider,
    useDrizzleIndexedDB,
  } from "@firtoz/drizzle-indexeddb";

  function App() {
    return (
      <DrizzleIndexedDBProvider db={db} schema={schema}>
        <TodoList />
      </DrizzleIndexedDBProvider>
    );
  }

  function TodoList() {
    const { getCollection } = useDrizzleIndexedDB();
    const todos = getCollection("todos");

    // Use collection with TanStack DB hooks...
  }
  ```

  ## Migration Workflow

  1. Generate Drizzle migrations: `drizzle-kit generate`
  2. Generate IndexedDB migrations: `bun drizzle-indexeddb-generate`
  3. Import migrations and call `migrateIndexedDBWithFunctions()` on app startup
  4. Database automatically updates to latest schema

  ## Dependencies

  - `@firtoz/drizzle-utils` (workspace)
  - `drizzle-orm`
  - `drizzle-valibot`
  - `@tanstack/db`
  - `valibot`
  - `react` (peer dependency)

### Patch Changes

- Updated dependencies [[`05e88e7`](https://github.com/firtoz/fullstack-toolkit/commit/05e88e775f262488d1da2b579eadd560cee2eba9)]:
  - @firtoz/drizzle-utils@0.1.0
