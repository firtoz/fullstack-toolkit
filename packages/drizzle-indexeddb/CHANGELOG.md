# @firtoz/drizzle-indexeddb

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

  ### Snapshot-Based Migration

  **`migrateIndexedDB(dbName, config, debug?)`** - Automatically migrates IndexedDB databases using Drizzle snapshot files:

  - Reads Drizzle journal and snapshot files
  - Tracks applied migrations in `__drizzle_migrations` store
  - Creates/updates object stores and indexes based on schema changes
  - Handles table deletion, index changes, and schema evolution
  - Incremental migrations - only applies pending changes
  - Validates primary key structure changes (requires manual migration if keys change)
  - Performance logging when debug mode is enabled

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
  import { migrateIndexedDB } from "@firtoz/drizzle-indexeddb";
  import journal from "./drizzle/journal.json";
  import * as snapshots from "./drizzle/snapshots";

  // Migrate database using Drizzle snapshots
  const db = await migrateIndexedDB(
    "my-app-db",
    {
      journal,
      snapshots,
    },
    true
  ); // debug mode

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

  1. Generate Drizzle snapshots: `drizzle-kit generate`
  2. Import journal and snapshots
  3. Call `migrateIndexedDB()` on app startup
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
