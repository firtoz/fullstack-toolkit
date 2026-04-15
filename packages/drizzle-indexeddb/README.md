# @firtoz/drizzle-indexeddb

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fdrizzle-indexeddb.svg)](https://www.npmjs.com/package/@firtoz/drizzle-indexeddb)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fdrizzle-indexeddb.svg)](https://www.npmjs.com/package/@firtoz/drizzle-indexeddb)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fdrizzle-indexeddb.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-000000)](https://orm.drizzle.team/)
[![IndexedDB](https://img.shields.io/badge/IndexedDB-browser-2563eb)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

**Drizzle-shaped schemas and migrations on top of IndexedDB** — TanStack DB collections in the browser with React hooks and generated migration functions (SQLite-flavored Drizzle types today).

> **⚠️ Early WIP Notice:** This package is in very early development and is **not production-ready**. It is TypeScript-only and may have breaking changes. While I (the maintainer) have limited time, I'm open to PRs for features, bug fixes, or additional support (like JS builds). Please feel free to try it out and contribute! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

> **Note:** This package currently builds on top of Drizzle's SQLite integration (using `drizzle-orm/sqlite-core` types) until Drizzle adds native IndexedDB support. The migration system uses function-based migrations generated from Drizzle's SQLite migrations to create IndexedDB object stores and indexes.

## Installation

```bash
npm install @firtoz/drizzle-indexeddb @firtoz/drizzle-utils drizzle-orm @tanstack/db
```

## Features

- ⚡ **TanStack DB collections** - Reactive collections with type safety (primary feature)
- 🎯 **Type-safe** - Full TypeScript support with automatic type inference
- 🔍 **Query optimization** - Leverage IndexedDB indexes for fast queries
- 📦 **Soft deletes** - Built-in support for `deletedAt` column
- ⚛️ **React hooks** - Provider and hooks for easy React integration
- 📝 **Function-based migrations** - Generated migration functions from Drizzle schema changes
- 🔄 **Multi-client sync** - IDB Proxy system for real-time sync across multiple clients (Chrome extensions, etc.)

## Quick Start

### 1. Setup Drizzle Schema

```typescript
// schema.ts
import { syncableTable } from "@firtoz/drizzle-utils";
import { text, integer } from "drizzle-orm/sqlite-core";

export const todoTable = syncableTable("todos", {
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
});
```

### 2. Generate Migrations

```bash
# Generate Drizzle migrations
drizzle-kit generate

# Generate IndexedDB migration functions
bun drizzle-indexeddb-generate
```

### 3. Migrate IndexedDB

```typescript
// db.ts
import { migrateIndexedDBWithFunctions } from "@firtoz/drizzle-indexeddb";
import migrations from "./drizzle/indexeddb-migrations";

export const db = await migrateIndexedDBWithFunctions(
  "my-app",
  migrations,
  true // Enable debug logging
);
```

### 4. Use with React

```typescript
// App.tsx
import { DrizzleIndexedDBProvider, useIndexedDBCollection } from "@firtoz/drizzle-indexeddb";
import { createCollection } from "@tanstack/db";

function App() {
  return (
    <DrizzleIndexedDBProvider db={db} schema={schema}>
      <TodoList />
    </DrizzleIndexedDBProvider>
  );
}

function TodoList() {
  const collection = useIndexedDBCollection("todos");
  const [todos] = collection.useStore();
  
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

## TanStack DB Collections

The primary feature of this package: Create reactive, type-safe collections backed by IndexedDB.

### Basic Usage

Create reactive collections backed by IndexedDB:

```typescript
import { createCollection } from "@tanstack/db";
import {
	drizzleIndexedDBCollectionOptions,
	type DrizzleIndexedDBCollection,
} from "@firtoz/drizzle-indexeddb";
import * as schema from "./schema";

const todosCollection = createCollection(
  drizzleIndexedDBCollectionOptions({
    indexedDBRef: { current: db },
    table: schema.todoTable,
    storeName: "todos",
    syncMode: "on-demand", // or "realtime"
  })
);

type TodosCollection = DrizzleIndexedDBCollection<typeof schema.todoTable>;

// Subscribe to changes
const unsubscribe = todosCollection.subscribe((todos) => {
  console.log("Todos updated:", todos);
});

// CRUD operations
await todosCollection.insert({
  title: "Buy milk",
  completed: false,
});

await todosCollection.update(todoId, {
  completed: true,
});

await todosCollection.delete(todoId); // Soft delete (sets deletedAt)

// Query with filters
const completedTodos = await todosCollection.find({
  where: { completed: true },
  orderBy: { createdAt: "desc" },
  limit: 10,
});
```

### Collection Options

```typescript
interface IndexedDBCollectionConfig {
  db: IDBDatabase;
  tableName: string;
  syncMode?: "on-demand" | "realtime";
  debug?: boolean;
}
```

### Supported Operations

- **Insert** - Add new records
- **Update** - Modify existing records
- **Delete** - Soft delete (sets `deletedAt`) or hard delete
- **Find** - Query with filters, sorting, pagination
- **Subscribe** - React to data changes

### Query Features

```typescript
// Filtering
collection.find({
  where: {
    completed: false,
    title: { contains: "urgent" },
    priority: { in: ["high", "critical"] },
    createdAt: { gt: yesterday },
  }
});

// Sorting
collection.find({
  orderBy: { createdAt: "desc" }
});

// Pagination
collection.find({
  limit: 10,
  offset: 20,
});

// Soft delete filtering (automatic)
// By default, records with deletedAt !== null are excluded
```

## Migration Methods

### Function-Based Migration

Use generated migration functions to migrate your IndexedDB schema:

```typescript
import { migrateIndexedDBWithFunctions } from "@firtoz/drizzle-indexeddb";
import migrations from "./drizzle/indexeddb-migrations";

const db = await migrateIndexedDBWithFunctions(
  "my-app-db",
  migrations,
  true // debug flag
);

console.log("Database migrated successfully!");
```

**Features:**
- Automatically creates/updates object stores
- Manages indexes based on Drizzle schema
- Handles table deletion
- Tracks applied migrations
- Validates primary key changes
- Incremental migrations (only applies pending changes)

**Migration Tracking:**

Migrations are tracked in the `__drizzle_migrations` object store:

```typescript
interface MigrationRecord {
  id: number;        // Migration index
  tag: string;       // Migration name
  when: number;      // Migration timestamp
  appliedAt: number; // When it was applied
}
```

### Custom Migration Functions

For complex migrations that require custom logic, you can write migration functions directly:

```typescript
import { migrateIndexedDBWithFunctions } from "@firtoz/drizzle-indexeddb";

const migrations = [
  // Migration 0: Initial schema
  {
    tag: "0000_initial",
    migrate: async (db: IDBDatabase, transaction: IDBTransaction) => {
      const store = db.createObjectStore("todos", { keyPath: "id" });
      store.createIndex("title", "title", { unique: false });
    },
  },
  
  // Migration 1: Add completed index
  {
    tag: "0001_add_completed",
    migrate: async (db: IDBDatabase, transaction: IDBTransaction) => {
      const store = transaction.objectStore("todos");
      store.createIndex("completed", "completed", { unique: false });
    },
  },
  
  // Migration 2: Transform data
  {
    tag: "0002_add_priority",
    migrate: async (db: IDBDatabase, transaction: IDBTransaction) => {
      const store = transaction.objectStore("todos");
      const todos = await new Promise<any[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      
      // Transform data
      for (const todo of todos) {
        todo.priority = todo.priority || "medium";
        store.put(todo);
      }
    },
  },
];

const db = await migrateIndexedDBWithFunctions("my-app-db", migrations, true);
```

## React Integration

### DrizzleIndexedDBProvider

Wrap your app with the provider:

```typescript
import { DrizzleIndexedDBProvider } from "@firtoz/drizzle-indexeddb";

function App() {
  return (
    <DrizzleIndexedDBProvider db={db} schema={schema}>
      <YourApp />
    </DrizzleIndexedDBProvider>
  );
}
```

### useDrizzleIndexedDB

Access the context:

```typescript
import { useDrizzleIndexedDB } from "@firtoz/drizzle-indexeddb";

function MyComponent() {
  const { getCollection } = useDrizzleIndexedDB();
  
  const todosCollection = getCollection("todos");
  const usersCollection = getCollection("users");
  
  // Use collections...
}
```

**Features:**
- Collection caching (same collection instance for same table)
- Reference counting for memory management
- Type-safe collection access

### useIndexedDBCollection

Hook for a specific collection:

```typescript
import { useIndexedDBCollection } from "@firtoz/drizzle-indexeddb";

function TodoList() {
  const collection = useIndexedDBCollection("todos");
  
  // Automatic ref counting and cleanup
  useEffect(() => {
    return () => {
      // Collection automatically cleaned up when component unmounts
    };
  }, []);
  
  // Use collection...
}
```

## Utilities

### deleteIndexedDB

Completely delete an IndexedDB database:

```typescript
import { deleteIndexedDB } from "@firtoz/drizzle-indexeddb";

await deleteIndexedDB("my-app-db");
console.log("Database deleted!");
```

Useful for:
- Resetting the database during development
- Clearing user data on logout
- Testing scenarios

### generateIndexedDBMigrations

Generate IndexedDB migration files from Drizzle snapshots programmatically:

```typescript
import { generateIndexedDBMigrations } from "@firtoz/drizzle-indexeddb";

generateIndexedDBMigrations({
  drizzleDir: "./drizzle",           // Path to Drizzle directory (default: ./drizzle)
  outputDir: "./drizzle/indexeddb-migrations",  // Output directory (default: ./drizzle/indexeddb-migrations)
});
```

## CLI

The package includes a CLI tool to generate IndexedDB migrations from Drizzle schema snapshots.

### Usage

```bash
# Generate migrations (run after drizzle-kit generate)
bun drizzle-indexeddb-generate

# With custom paths
bun drizzle-indexeddb-generate --drizzle-dir ./db/drizzle
bun drizzle-indexeddb-generate --output-dir ./src/migrations

# Show help
bun drizzle-indexeddb-generate --help
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--drizzle-dir <path>`, `-d` | Path to Drizzle directory | `./drizzle` |
| `--output-dir <path>`, `-o` | Path to output directory | `<drizzle-dir>/indexeddb-migrations` |

### npm scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "db:generate": "bun --bun drizzle-kit generate && bun drizzle-indexeddb-generate"
  }
}
```

> **Note:** The `--bun` flag forces bun's runtime instead of Node, which is needed because this package exports raw TypeScript. See [Troubleshooting](#err_unsupported_node_modules_type_stripping-error) if you encounter type stripping errors.

## Advanced Usage

### Custom Sync Configuration

```typescript
import { indexedDBCollectionOptions } from "@firtoz/drizzle-indexeddb";

const collection = createCollection(
  indexedDBCollectionOptions({
    db,
    tableName: "todos",
    syncMode: "realtime", // Subscribe to changes automatically
    debug: true, // Enable debug logging
  })
);
```

### Collection Truncate

Clear all data from a collection:

```typescript
// Clear all todos
await todoCollection.utils.truncate();
```

This clears the IndexedDB store and updates the local reactive store.

## IDB Proxy System

For scenarios where IndexedDB needs to be accessed over a messaging layer (e.g., Chrome extensions, WebSockets), the proxy system enables multi-client sync:

### Overview

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Client 1│     │ Client 2│     │ Client N│
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
              ┌──────▼──────┐
              │   Server    │
              │  (manages   │
              │  IndexedDB) │
              └─────────────┘
```

- **Server** manages database lifecycle, migrations, and broadcasts mutations
- **Clients** connect via a transport layer and receive real-time sync updates
- All insert/update/delete/truncate operations sync to all connected clients

### Basic Setup

```typescript
import {
  createMultiClientTransport,
  createProxyServer,
  createProxyIDbCreator,
  migrateIndexedDBWithFunctions,
  DrizzleIndexedDBProvider,
} from "@firtoz/drizzle-indexeddb";

// Create transport (in-memory for testing, or custom for production)
const { createClientTransport, serverTransport } = createMultiClientTransport();

// Create server with migrations
const server = createProxyServer({
  transport: serverTransport,
  dbCreator: async (dbName) => {
    return await migrateIndexedDBWithFunctions(dbName, migrations);
  },
});

// Create client
const clientTransport = createClientTransport();
const dbCreator = createProxyIDbCreator(clientTransport);

// Use with React provider
function App() {
  const handleSyncReady = useCallback((handleSync) => {
    clientTransport.onSync(handleSync);
  }, []);

  return (
    <DrizzleIndexedDBProvider
      dbName="my-app.db"
      schema={schema}
      dbCreator={dbCreator}
      onSyncReady={handleSyncReady}
    >
      <YourApp />
    </DrizzleIndexedDBProvider>
  );
}
```

### Multiple Clients

```typescript
// Server setup (once)
const { createClientTransport, serverTransport } = createMultiClientTransport();
const server = createProxyServer({ transport: serverTransport, ... });

// Each client gets its own transport
const client1Transport = createClientTransport();
const client2Transport = createClientTransport();
const client3Transport = createClientTransport();

// All clients share the same data and receive real-time sync
```

### Sync Operations

All standard collection operations automatically sync:

```typescript
// Client 1 inserts
await todoCollection.insert({ title: "Buy milk", completed: false });
// → Client 2, 3, N receive the new todo instantly

// Client 2 updates
await todoCollection.update(todoId, (draft) => {
  draft.completed = true;
});
// → Client 1, 3, N see the update instantly

// Client 3 deletes
await todoCollection.delete(todoId);
// → Client 1, 2, N see the deletion instantly

// Client N truncates
await todoCollection.utils.truncate();
// → All clients are cleared instantly
```

### Custom Transport

For production use (Chrome extension, WebSocket, etc.), implement the transport interface:

```typescript
import type { IDBProxyClientTransport, IDBProxyServerTransport } from "@firtoz/drizzle-indexeddb";

// Client transport (e.g., in content script)
const clientTransport: IDBProxyClientTransport = {
  sendRequest: async (request) => {
    // Send to background script and wait for response
    return await chrome.runtime.sendMessage(request);
  },
  onSync: (handler) => {
    // Listen for sync broadcasts
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type?.startsWith("sync:")) handler(msg);
    });
  },
};

// Server transport (e.g., in background script)
const serverTransport: IDBProxyServerTransport = {
  onRequest: (handler) => {
    chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
      const response = await handler(msg);
      sendResponse(response);
    });
  },
  broadcast: (message, excludeClientId) => {
    // Broadcast to all connected tabs except sender
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id !== excludeClientId) {
          chrome.tabs.sendMessage(tab.id, message);
        }
      }
    });
  },
};
```

### Handling Migration Errors

```typescript
try {
  const db = await migrateIndexedDBWithFunctions("my-app", migrations, true);
} catch (error) {
  console.error("Migration failed:", error);
  
  // Option 1: Delete and start fresh
  await deleteIndexedDB("my-app");
  const db = await migrateIndexedDBWithFunctions("my-app", migrations, true);
  
  // Option 2: Handle specific errors
  if (error.message.includes("Primary key structure changed")) {
    // Guide user to export data, delete DB, and reimport
  }
}
```

### Performance Optimization

```typescript
// Enable debug mode to see performance metrics
const db = await migrateIndexedDBWithFunctions("my-app", migrations, true);

// Output shows:
// [PERF] IndexedDB function migrator start for my-app
// [PERF] Latest applied migration index: 5 (checked 5 migrations)
// [PERF] Found 2 pending migrations to apply: ["add_priority", "add_category"]
// [PERF] Upgrade started: v5 → v7
// [PERF] Creating object store: categories
// [PERF] Creating index: name on categories
// [PERF] Migration 5 complete
// [PERF] Migration 6 complete
// [PERF] All 2 migrations applied successfully
// [PERF] Migrator complete - database ready
```

## Schema Changes

### Adding a Column

Just update your schema and regenerate:

```typescript
// Before
const todoTable = syncableTable("todos", {
  title: text("title").notNull(),
});

// After
const todoTable = syncableTable("todos", {
  title: text("title").notNull(),
  priority: text("priority").notNull().default("medium"),
});
```

```bash
drizzle-kit generate
```

The migrator handles it automatically!

### Adding an Index

```typescript
const todoTable = syncableTable("todos", {
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }),
}, (table) => [
  index("title_idx").on(table.title),
  index("completed_idx").on(table.completed),
]);
```

### Renaming a Column

Drizzle migrations don't track renames directly, but you can:

1. Modify the generated migration function to handle data transformation
2. Or: Add new column, copy data, delete old column (3 separate migrations)

### Deleting a Table

Remove from schema and regenerate - the migrator will delete the object store.

## Troubleshooting

### "ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING" Error

If you see this error when running `drizzle-kit generate`:

```
Error [ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING]: Stripping types is currently unsupported for files under node_modules
```

This happens because this package exports raw TypeScript files, and Node's built-in type stripping doesn't work inside `node_modules`.

**Solution:** Use `bun --bun` to force bun's runtime instead of Node:

```bash
bun --bun drizzle-kit generate
```

Or in your `package.json`:

```json
{
  "scripts": {
    "db:generate": "bun --bun drizzle-kit generate && bun drizzle-indexeddb-generate"
  }
}
```

**Alternative:** If you're not using bun, use `tsx`:

```bash
npx tsx node_modules/drizzle-kit/bin.cjs generate --config ./drizzle.config.ts
```

### "Primary key structure changed" Error

This happens when you change the primary key of a table. IndexedDB doesn't support changing keyPath after creation.

**Solution:**
1. Export your data
2. Delete the database: `await deleteIndexedDB("my-app")`
3. Re-run migrations
4. Import your data

### Migrations Not Applying

- Check that migrations are correctly imported from `drizzle/indexeddb-migrations/`
- Verify the migration files exist - run `bun drizzle-indexeddb-generate` to regenerate
- Enable debug mode to see what's happening
- Check browser DevTools → Application → IndexedDB

### Performance Issues

- Add indexes to frequently queried columns
- Use `syncMode: "on-demand"` for collections that don't need real-time updates
- Consider pagination for large datasets
- Use `deletedAt` soft deletes instead of hard deletes for better performance

## License

MIT

## Author

Firtina Ozbalikchi <firtoz@github.com>

