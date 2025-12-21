# @firtoz/drizzle-utils

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
