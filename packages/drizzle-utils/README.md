# @firtoz/drizzle-utils

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fdrizzle-utils.svg)](https://www.npmjs.com/package/@firtoz/drizzle-utils)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fdrizzle-utils.svg)](https://www.npmjs.com/package/@firtoz/drizzle-utils)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fdrizzle-utils.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-000000)](https://orm.drizzle.team/)

**Shared utilities for Drizzle-based stacks** — syncable table builders, branded IDs, migration helpers, and collection-sync primitives shared across `@firtoz/drizzle-*` packages.

> **⚠️ Early WIP Notice:** This package is in very early development and is **not production-ready**. It is TypeScript-only and may have breaking changes. While I (the maintainer) have limited time, I'm open to PRs for features, bug fixes, or additional support (like JS builds). Please feel free to try it out and contribute! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

## Installation

```bash
npm install @firtoz/drizzle-utils drizzle-orm drizzle-valibot
```

## Features

### 🏗️ Syncable Table Builder

Create SQLite tables with automatic timestamp tracking and UUID primary keys:

```typescript
import { syncableTable } from "@firtoz/drizzle-utils";
import { text, integer } from "drizzle-orm/sqlite-core";

const todoTable = syncableTable("todos", {
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  description: text("description"),
});

// Automatically includes:
// - id: TableId<"todos"> (UUID primary key)
// - createdAt: Date (auto-set on insert)
// - updatedAt: Date (auto-set on update)
// - deletedAt: Date | null (for soft deletes)

type Todo = typeof todoTable.$inferSelect;
// {
//   id: TableId<"todos">;
//   title: string;
//   completed: boolean;
//   description: string | null;
//   createdAt: Date;
//   updatedAt: Date;
//   deletedAt: Date | null;
// }
```

### 🏷️ Branded ID Types

Type-safe IDs with table-specific branding prevent mixing IDs from different tables:

```typescript
import { makeId, type IdOf } from "@firtoz/drizzle-utils";

const todoId = makeId(todoTable, "123e4567-e89b-12d3-a456-426614174000");
const userId = makeId(userTable, "123e4567-e89b-12d3-a456-426614174000");

// TypeScript prevents mixing different table IDs
function getTodo(id: IdOf<typeof todoTable>) { /* ... */ }

getTodo(todoId);  // ✅ OK
getTodo(userId);  // ❌ Type error - wrong table!
```

### 📋 Column Helpers

Individual column builders for custom table definitions:

```typescript
import { 
  idColumn, 
  createdAtColumn, 
  updatedAtColumn, 
  deletedAtColumn 
} from "@firtoz/drizzle-utils";

// Use in custom table definitions
const customTable = sqliteTable("custom", {
  id: idColumn,
  name: text("name").notNull(),
  createdAt: createdAtColumn,
  updatedAt: updatedAtColumn,
  deletedAt: deletedAtColumn,
});
```

### 🔄 Migration Types

Shared TypeScript types for Drizzle migrations across IndexedDB and SQLite:

```typescript
import type { 
  Journal, 
  JournalEntry,
  Snapshot,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition
} from "@firtoz/drizzle-utils";

// Use these types for custom migration logic
function applyMigration(snapshot: Snapshot) {
  for (const [tableName, table] of Object.entries(snapshot.tables)) {
    const tableDef: TableDefinition = table;
    // ... migration logic
  }
}
```

### 📝 Schema Type Helpers

Type-safe Valibot schema inference:

```typescript
import { type SelectSchema, type InsertSchema } from "@firtoz/drizzle-utils";

type TodoSelect = SelectSchema<typeof todoTable>;
type TodoInsert = InsertSchema<typeof todoTable>;

// Use with Valibot for runtime validation
import { parse } from "valibot";
import { createSelectSchema, createInsertSchema } from "drizzle-valibot";

const selectSchema = createSelectSchema(todoTable);
const insertSchema = createInsertSchema(todoTable);

const validTodo = parse(selectSchema, data);
```

## API Reference

### Table Builders

#### `syncableTable(name, columns, extraConfig?)`

Creates a SQLite table with automatic timestamp tracking.

**Parameters:**
- `name: string` - Table name
- `columns: Record<string, SQLiteColumnBuilder>` - Column definitions (cannot use `id`, `createdAt`, `updatedAt`, or `deletedAt` as keys)
- `extraConfig?: (self) => SQLiteTableExtraConfigValue[]` - Optional indexes and constraints

**Returns:** SQLite table with id, createdAt, updatedAt, deletedAt columns

**Validation:**
- Ensures default values are compatible with IndexedDB (no SQL expressions)
- Throws error if SQL expressions are used as default values

### Column Helpers

#### `idColumn`

Text column configured as primary key with branded UUID type.

#### `createdAtColumn`

Integer timestamp column (mode: "timestamp") with automatic default (current date).

#### `updatedAtColumn`

Integer timestamp column (mode: "timestamp") with automatic default (current date).

#### `deletedAtColumn`

Nullable integer timestamp column (mode: "timestamp") for soft deletes.

### Type Utilities

#### `Branded<T, Brand>`

Creates a branded type for better type safety.

#### `TableId<TTableName>`

Table-specific branded ID type with table name in the brand.

#### `IdOf<TTable>`

Extracts the ID type from a Drizzle table.

#### `makeId<TTable>(table, value)`

Safely creates a branded ID for a specific table.

#### `SelectSchema<TTable>`

Infers the Valibot select schema type from a Drizzle table.

#### `InsertSchema<TTable>`

Infers the Valibot insert schema type from a Drizzle table.

### Migration Types

Comprehensive types for database migrations:

- `Journal` - Migration journal with version and entries
- `JournalEntry` - Individual migration record
- `Snapshot` - Complete database schema snapshot
- `TableDefinition` - Table structure definition
- `ColumnDefinition` - Column configuration
- `IndexDefinition` - Index configuration
- `ForeignKeyDefinition` - Foreign key constraint
- `ViewDefinition` - Database view definition
- `EnumDefinition` - Enum type definition

### Collection Sync Utilities

Support for external sync and collection utilities:

#### External Sync Events

Push sync events from external sources (e.g., proxy servers) to collections:

```typescript
import type { ExternalSyncEvent, ExternalSyncHandler } from "@firtoz/drizzle-utils";

// Receive sync events from a server
const handleSync: ExternalSyncHandler<Todo> = (event) => {
  switch (event.type) {
    case "insert":
      // event.items contains new items
      break;
    case "update":
      // event.items contains updated items
      break;
    case "delete":
      // event.items contains deleted items
      break;
    case "truncate":
      // All items should be cleared
      break;
  }
};

// Push events to a collection's reactive store
syncResult.pushExternalSync({ type: "insert", items: [newTodo] });
syncResult.pushExternalSync({ type: "truncate" });
```

#### Collection Utils

The `SyncFunctionResult` includes utilities for common operations:

```typescript
// Truncate (clear all data)
await collection.utils.truncate();
```

#### SyncBackend Interface

For implementing custom backends, the `SyncBackend` interface includes:

```typescript
interface SyncBackend<TTable> {
  initialLoad: (write) => Promise<void>;
  loadSubset: (options, write) => Promise<void>;
  handleInsert: (mutations) => Promise<T[]>;
  handleUpdate: (mutations) => Promise<T[]>;
  handleDelete: (mutations) => Promise<void>;
  handleTruncate?: () => Promise<void>; // Optional truncate support
}
```

## Best Practices

### 1. Use syncableTable for Data Tables

Always use `syncableTable` for tables that need timestamp tracking:

```typescript
// ✅ Good - automatic timestamps
const todoTable = syncableTable("todos", {
  title: text("title").notNull(),
});

// ❌ Bad - manual timestamp management
const todoTable = sqliteTable("todos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  // ... repetitive boilerplate
});
```

### 2. Leverage Branded IDs

Use branded IDs to prevent mixing IDs from different tables:

```typescript
type TodoId = IdOf<typeof todoTable>;
type UserId = IdOf<typeof userTable>;

function assignTodo(todoId: TodoId, userId: UserId) {
  // Type safety ensures correct ID types are used
}
```

### 3. Avoid SQL Expressions in Defaults

The `syncableTable` validates that default values work with IndexedDB:

```typescript
// ✅ Good - JavaScript default
const table = syncableTable("table", {
  status: text("status").default("pending"),
  count: integer("count").default(0),
});

// ❌ Bad - SQL expression (will throw error)
const table = syncableTable("table", {
  status: text("status").default(sql`'pending'`),  // Error!
});
```

## Integration

This package is used by:
- `@firtoz/drizzle-indexeddb` - IndexedDB migrations
- `@firtoz/drizzle-sqlite-wasm` - SQLite WASM integration

## License

MIT

## Author

Firtina Ozbalikchi <firtoz@github.com>

