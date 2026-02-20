# @firtoz/drizzle-sqlite-wasm

## 0.2.10

### Patch Changes

- Updated dependencies [[`3c7ce1d`](https://github.com/firtoz/fullstack-toolkit/commit/3c7ce1dbca5c5396386db9927ae7f5e19a562cf6), [`3c7ce1d`](https://github.com/firtoz/fullstack-toolkit/commit/3c7ce1dbca5c5396386db9927ae7f5e19a562cf6)]:
  - @firtoz/db-helpers@1.0.0
  - @firtoz/drizzle-utils@1.0.0

## 0.2.9

### Patch Changes

- Updated dependencies [[`ec365af`](https://github.com/firtoz/fullstack-toolkit/commit/ec365af8c17bcd7efc2b0cf9b3bed5225b853e72)]:
  - @firtoz/drizzle-utils@0.3.3
  - @firtoz/worker-helper@1.3.4

## 0.2.8

### Patch Changes

- Updated dependencies [[`8f3143f`](https://github.com/firtoz/fullstack-toolkit/commit/8f3143ff5d9953350d2388d46ea7c859e7dbeda5)]:
  - @firtoz/worker-helper@1.3.3

## 0.2.7

### Patch Changes

- Updated dependencies [[`70856f6`](https://github.com/firtoz/fullstack-toolkit/commit/70856f6b055d6d149ee1edc703a5c2acf451be4a)]:
  - @firtoz/worker-helper@1.3.2

## 0.2.6

### Patch Changes

- Updated dependencies [[`07b8aec`](https://github.com/firtoz/fullstack-toolkit/commit/07b8aecc1e3ecde6ed497965c2c40770b85a341d)]:
  - @firtoz/worker-helper@1.3.1

## 0.2.5

### Patch Changes

- Updated dependencies [[`ef2b36e`](https://github.com/firtoz/fullstack-toolkit/commit/ef2b36e4be4fda049f02f1d000649e4c75ff08ec)]:
  - @firtoz/worker-helper@1.3.0

## 0.2.4

### Patch Changes

- Updated dependencies [[`2725815`](https://github.com/firtoz/fullstack-toolkit/commit/27258158dd318b34b44ed77b88b2ac9b2b4b6a3d), [`2725815`](https://github.com/firtoz/fullstack-toolkit/commit/27258158dd318b34b44ed77b88b2ac9b2b4b6a3d)]:
  - @firtoz/worker-helper@1.2.0
  - @firtoz/drizzle-utils@0.3.2

## 0.2.3

### Patch Changes

- [`d97681f`](https://github.com/firtoz/fullstack-toolkit/commit/d97681f56e103d033292005d31f298b03b4fa7ca) Thanks [@firtoz](https://github.com/firtoz)! - Add comprehensive Vite configuration documentation for OPFS support. Includes required COOP/COEP headers and a custom plugin to fix the sqlite-wasm 3.51.x OPFS proxy worker module format issue ("Unexpected token 'export'" error).

- Updated dependencies [[`b0f7893`](https://github.com/firtoz/fullstack-toolkit/commit/b0f789314c4ee85d8c08466b968baad2977a2581)]:
  - @firtoz/worker-helper@1.1.0

## 0.2.2

### Patch Changes

- [`8abab0a`](https://github.com/firtoz/fullstack-toolkit/commit/8abab0ae7a99320a4254cb128c0fd823726e58e0) Thanks [@firtoz](https://github.com/firtoz)! - Fix critical bug where debug mode prevented database operations from executing. Debug handlers now properly wrap and call the actual backend handlers instead of replacing them.

  Add cursor-based and offset-based pagination support to `loadSubset` operations, enabling efficient navigation through large datasets.

  Add `SQLInterceptor` support to log all SQL queries, including direct Drizzle queries, with the new `createInstrumentedDrizzle` function. This provides comprehensive query visibility for debugging and monitoring.

  Add explicit return type `SqliteCollectionConfig<TTable>` to `sqliteCollectionOptions` function, improving type safety and eliminating the `any` cast at the return statement.

- Updated dependencies [[`8abab0a`](https://github.com/firtoz/fullstack-toolkit/commit/8abab0ae7a99320a4254cb128c0fd823726e58e0), [`8abab0a`](https://github.com/firtoz/fullstack-toolkit/commit/8abab0ae7a99320a4254cb128c0fd823726e58e0)]:
  - @firtoz/maybe-error@1.5.2
  - @firtoz/drizzle-utils@0.3.1

## 0.2.1

### Patch Changes

- Updated dependencies [[`46059a2`](https://github.com/firtoz/fullstack-toolkit/commit/46059a28bd0135414b9ed022ffe162a2292adae3)]:
  - @firtoz/drizzle-utils@0.3.0

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

- [#22](https://github.com/firtoz/fullstack-toolkit/pull/22) [`05e88e7`](https://github.com/firtoz/fullstack-toolkit/commit/05e88e775f262488d1da2b579eadd560cee2eba9) Thanks [@firtoz](https://github.com/firtoz)! - Initial release of `@firtoz/drizzle-sqlite-wasm` - TanStack DB collections backed by SQLite WASM running in Web Workers, with full Drizzle ORM integration.

  > **⚠️ Early WIP Notice:** This package is in very early development and is **not production-ready**. It is TypeScript-only and may have breaking changes. While I (the maintainer) have limited time, I'm open to PRs for features, bug fixes, or additional support (like JS builds). Please feel free to try it out and contribute! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

  ## Features

  ### TanStack DB Collections (Primary Feature)

  **`drizzleCollectionOptions(config)`** - The main feature: Create reactive TanStack DB collections backed by SQLite WASM:

  - Type-safe CRUD operations
  - Reactive subscriptions to data changes
  - Soft delete support
  - Query optimization with SQLite indexes
  - Pagination and sorting
  - Non-blocking operations via Web Workers

  **IndexedDB fallback** - Re-exports `indexedDBCollectionOptions` from `@firtoz/drizzle-indexeddb`:

  - Seamless integration between SQLite and IndexedDB
  - Use IndexedDB for offline-first sync layer
  - Consistent API across both storage backends

  ### Worker-Based SQLite

  **`SqliteWorkerManager`** - Manages multiple SQLite databases in a single worker:

  - Efficient resource utilization with shared worker
  - Database instance caching and lifecycle management
  - Automatic migration handling
  - Global manager for singleton worker access

  **`initializeSqliteWorker()`** - Initialize the global SQLite worker:

  - Accepts any Worker constructor for bundler compatibility
  - Debug mode for performance tracking
  - Returns manager for manual control

  ### Drizzle Integration

  **`drizzleSqliteWasmWorker(client, config, debug?)`** - Create Drizzle instance backed by worker:

  - Full Drizzle ORM API with type safety
  - Async query execution via Worker
  - Automatic serialization/deserialization

  **`drizzleSqliteWasm(sqliteDb, config, debug?)`** - Direct Drizzle instance (non-worker):

  - Use SQLite WASM directly in main thread
  - Same Drizzle ORM API
  - Ideal for testing or synchronous contexts

  ### Migrations

  **`customSqliteMigrate(config)`** - Custom SQLite migration system:

  - Compatible with Drizzle snapshots
  - Handles SQL migrations
  - Tracks applied migrations
  - Journal-based migration history

  ### React Integration

  **`DrizzleSqliteProvider`** - React context provider:

  - Manages worker lifecycle
  - Automatic database initialization
  - Collection caching with ref counting
  - Type-safe context

  **`useDrizzleSqliteDb(Worker, dbName, schema, migrations)`** - React hook for SQLite:

  - Automatic worker management
  - Migration handling
  - Ready promise for initialization tracking
  - Bundler-agnostic Worker support

  **`useDrizzleSqlite()`** - Access Drizzle SQLite context:

  - Get Drizzle instance
  - Access collections with type safety

  **`useSqliteCollection(tableName)`** - Hook for specific collections:

  - Automatic ref counting
  - Type-safe collection access

  ### Performance Utilities

  Built-in performance monitoring tools:

  - `getPerformanceMetrics()` - Get detailed timing metrics
  - `getPerformanceMarks()` - Access performance marks
  - `logPerformanceMetrics()` - Log performance data
  - `exportPerformanceData()` - Export metrics for analysis
  - `clearPerformanceData()` - Clear performance history
  - `createPerformanceObserver()` - Custom performance observers

  ### Type Utilities

  Re-exports from `@firtoz/drizzle-utils`:

  - `syncableTable` - Create tables with timestamp tracking
  - `makeId` - Type-safe ID creation
  - `IdOf`, `TableId`, `Branded` - Type utilities
  - `SelectSchema`, `InsertSchema` - Schema helpers

  ## Bundler Support

  Works with all major bundlers:

  **Vite:**

  ```typescript
  import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
  const { drizzle } = useDrizzleSqliteDb(
    SqliteWorker,
    "mydb",
    schema,
    migrations
  );
  ```

  **Webpack 5+:**

  ```typescript
  const SqliteWorker = class extends Worker {
    constructor() {
      super(
        new URL(
          "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker",
          import.meta.url
        ),
        { type: "module" }
      );
    }
  };
  const { drizzle } = useDrizzleSqliteDb(
    SqliteWorker,
    "mydb",
    schema,
    migrations
  );
  ```

  **Parcel 2+:**

  ```typescript
  const SqliteWorker = class extends Worker {
    constructor() {
      super(
        new URL(
          "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker",
          import.meta.url
        )
      );
    }
  };
  const { drizzle } = useDrizzleSqliteDb(
    SqliteWorker,
    "mydb",
    schema,
    migrations
  );
  ```

  ## Example

  ```typescript
  import {
    DrizzleSqliteProvider,
    useDrizzleSqliteDb,
  } from "@firtoz/drizzle-sqlite-wasm";
  import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
  import * as schema from "./schema";
  import migrations from "./migrations";

  function App() {
    return (
      <DrizzleSqliteProvider
        worker={SqliteWorker}
        dbName="my-app-db"
        schema={schema}
        migrations={migrations}
      >
        <TodoList />
      </DrizzleSqliteProvider>
    );
  }

  function TodoList() {
    const { drizzle } = useDrizzleSqliteDb(
      SqliteWorker,
      "my-app-db",
      schema,
      migrations
    );

    // Use Drizzle ORM
    const todos = await drizzle.select().from(schema.todoTable);

    // Or use TanStack DB collections
    const collection = useSqliteCollection("todos");
  }
  ```

  ## Dependencies

  - `@firtoz/drizzle-indexeddb` (workspace)
  - `@firtoz/drizzle-utils` (workspace)
  - `@firtoz/maybe-error` (workspace)
  - `@firtoz/worker-helper` (workspace)
  - `@sqlite.org/sqlite-wasm`
  - `drizzle-orm`
  - `drizzle-valibot`
  - `@tanstack/db`
  - `react`
  - `zod`

### Patch Changes

- Updated dependencies [[`05e88e7`](https://github.com/firtoz/fullstack-toolkit/commit/05e88e775f262488d1da2b579eadd560cee2eba9), [`cf12782`](https://github.com/firtoz/fullstack-toolkit/commit/cf1278236e484e6350eb614ce2381e0afcec326e)]:
  - @firtoz/drizzle-utils@0.1.0
  - @firtoz/worker-helper@1.0.0
