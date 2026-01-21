# @firtoz/drizzle-sqlite-wasm

TanStack DB collections backed by SQLite WASM running in Web Workers, with full Drizzle ORM integration. Build reactive, type-safe SQLite applications in the browser with non-blocking database operations.

> **⚠️ Early WIP Notice:** This package is in very early development and is **not production-ready**. It is TypeScript-only and may have breaking changes. While I (the maintainer) have limited time, I'm open to PRs for features, bug fixes, or additional support (like JS builds). Please feel free to try it out and contribute! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

## Installation

```bash
npm install @firtoz/drizzle-sqlite-wasm @firtoz/drizzle-utils drizzle-orm @tanstack/db
```

## Features

- 📦 **TanStack DB collections** - Reactive collections with type safety (primary feature)
- 🔄 **Web Worker support** - Non-blocking SQLite in a dedicated worker
- ⚡ **Drizzle ORM** - Full type-safe query builder
- 🎯 **Type-safe** - Full TypeScript support with automatic type inference
- 🔍 **Query optimization** - Leverage SQLite indexes for fast queries
- ⚛️ **React hooks** - Provider and hooks for easy integration
- 🔄 **Migrations** - Automatic schema migrations with Drizzle snapshots
- 🔌 **Bundler agnostic** - Works with Vite, Webpack, Parcel, and more

## Quick Start

### 1. Define Your Schema

```typescript
// schema.ts
import { syncableTable } from "@firtoz/drizzle-utils";
import { text, integer } from "drizzle-orm/sqlite-core";

export const todoTable = syncableTable("todos", {
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  description: text("description"),
});

export const schema = { todoTable };
```

### 2. Generate Migrations

```bash
# Generate Drizzle migrations
drizzle-kit generate
```

### 3. Setup Worker (Vite Example)

```typescript
// App.tsx
import { DrizzleSqliteProvider } from "@firtoz/drizzle-sqlite-wasm";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import * as schema from "./schema";
import migrations from "./migrations";

function App() {
  return (
    <DrizzleSqliteProvider
      worker={SqliteWorker}
      dbName="my-app"
      schema={schema}
      migrations={migrations}
    >
      <TodoApp />
    </DrizzleSqliteProvider>
  );
}
```

### 4. Use in Components

```typescript
// TodoList.tsx
import { useDrizzleSqlite, useSqliteCollection } from "@firtoz/drizzle-sqlite-wasm";
import { todoTable } from "./schema";

function TodoList() {
  const { drizzle } = useDrizzleSqlite();
  
  // Option 1: Use Drizzle ORM directly
  const loadTodos = async () => {
    const todos = await drizzle.select().from(todoTable).all();
    return todos;
  };
  
  // Option 2: Use TanStack DB collection
  const collection = useSqliteCollection("todos");
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

## Bundler Support

### Vite

Vite has built-in support for Web Workers with the `?worker` suffix:

```typescript
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";

const { drizzle } = useDrizzleSqliteDb(SqliteWorker, "mydb", schema, migrations);
```

#### Required Vite Configuration for OPFS Support

To enable OPFS (Origin Private File System) persistence with SQLite WASM, you need to configure Vite properly. Add the following to your `vite.config.ts`:

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // Required: Set COOP/COEP headers for SharedArrayBuffer support
    {
      name: "configure-response-headers",
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          next();
        });
      },
    },
    // Required: Fix for sqlite-wasm OPFS proxy worker module format
    {
      name: "sqlite-wasm-opfs-fix",
      enforce: "pre",
      transform(code, id) {
        // Transform worker creation calls to use module type
        if (
          id.includes("@sqlite.org/sqlite-wasm") &&
          code.includes("new Worker")
        ) {
          // This fixes the "Unexpected token 'export'" error in OPFS proxy worker
          let transformed = code;
          const workerRegex =
            /new\s+Worker\s*\(\s*(new\s+URL\s*\([^)]+,[^)]+\))\s*\)/g;
          transformed = transformed.replace(
            workerRegex,
            "new Worker($1, { type: 'module' })",
          );

          if (transformed !== code) {
            return {
              code: transformed,
              map: null,
            };
          }
        }
      },
    },
  ],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
  worker: {
    format: "es",
  },
});
```

**Why is this needed?**

1. **COOP/COEP Headers**: Required for `SharedArrayBuffer` support, which OPFS needs for synchronous file operations
2. **Worker Module Fix**: sqlite-wasm 3.51.x creates workers without specifying `{ type: 'module' }`, causing syntax errors when the OPFS proxy worker (which uses ES module syntax) is loaded
3. **Worker Format**: Ensures all workers are treated as ES modules
4. **Exclude from Optimization**: Prevents Vite from pre-bundling sqlite-wasm, which can break worker creation

For a complete example, see [`tests/test-playground/vite.config.ts`](../../tests/test-playground/vite.config.ts) in the repository.

### Webpack 5+

Use `new URL()` with `import.meta.url`:

```typescript
const SqliteWorker = class extends Worker {
  constructor() {
    super(
      new URL("@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker", import.meta.url),
      { type: "module" }
    );
  }
};

const { drizzle } = useDrizzleSqliteDb(SqliteWorker, "mydb", schema, migrations);
```

### Parcel 2+

Similar to Webpack:

```typescript
const SqliteWorker = class extends Worker {
  constructor() {
    super(
      new URL("@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker", import.meta.url)
    );
  }
};

const { drizzle } = useDrizzleSqliteDb(SqliteWorker, "mydb", schema, migrations);
```

## TanStack DB Collections

The primary feature of this package: Create reactive, type-safe collections backed by SQLite WASM.

### Basic Usage

Create TanStack DB collections backed by SQLite:

```typescript
import { createCollection } from "@tanstack/db";
import { drizzleCollectionOptions } from "@firtoz/drizzle-sqlite-wasm/drizzleCollectionOptions";

const collection = createCollection(
  drizzleCollectionOptions({
    drizzle,
    tableName: "todos",
    readyPromise,
    syncMode: "on-demand", // or "realtime"
  })
);

// CRUD operations
await collection.insert({ title: "Buy milk", completed: false });
await collection.update(todoId, { completed: true });
await collection.delete(todoId); // Soft delete (sets deletedAt)

// Query with filters
const completed = await collection.find({
  where: { completed: true },
  orderBy: { createdAt: "desc" },
});

// Subscribe to changes
collection.subscribe((todos) => {
  console.log("Todos updated:", todos);
});
```

### Collection Options

**Config:**
- `drizzle: DrizzleDB` - Drizzle instance
- `tableName: string` - Table name
- `readyPromise: Promise<void>` - Database ready promise
- `syncMode?: "on-demand" | "realtime"` - Sync mode

## API Reference

### React Hooks

#### `DrizzleSqliteProvider`

Context provider for SQLite WASM:

```typescript
<DrizzleSqliteProvider
  worker={SqliteWorker}           // Worker constructor
  dbName="my-app"                 // Database name
  schema={schema}                 // Drizzle schema
  migrations={migrations}         // Migration config
>
  {children}
</DrizzleSqliteProvider>
```

**Props:**
- `worker: new () => Worker` - Worker constructor (bundler-specific)
- `dbName: string` - Name of the SQLite database
- `schema: TSchema` - Drizzle schema object
- `migrations: DurableSqliteMigrationConfig` - Migration configuration

#### `useDrizzleSqliteDb(worker, dbName, schema, migrations)`

Hook to create a Drizzle instance with Web Worker:

```typescript
function MyComponent() {
  const { drizzle, readyPromise } = useDrizzleSqliteDb(
    SqliteWorker,
    "my-app",
    schema,
    migrations
  );
  
  useEffect(() => {
    readyPromise.then(() => {
      console.log("Database ready!");
    });
  }, [readyPromise]);
  
  // Use drizzle...
}
```

**Returns:**
- `drizzle: DrizzleDB` - Drizzle ORM instance
- `readyPromise: Promise<void>` - Resolves when database is ready

#### `useDrizzleSqlite()`

Access the Drizzle context:

```typescript
function MyComponent() {
  const { drizzle, getCollection } = useDrizzleSqlite();
  
  // Use drizzle or get collections...
}
```

**Returns:**
- `drizzle: DrizzleDB` - Drizzle ORM instance
- `getCollection: (tableName) => Collection` - Get TanStack DB collection

#### `useSqliteCollection(tableName)`

Hook for a specific collection with automatic ref counting:

```typescript
function TodoList() {
  const collection = useSqliteCollection("todos");
  const [todos] = collection.useStore();
  
  // Collection is automatically cleaned up on unmount
}
```

### Worker API

#### `SqliteWorkerManager`

Manages multiple SQLite databases in a single worker:

```typescript
import { getSqliteWorkerManager, initializeSqliteWorker } from "@firtoz/drizzle-sqlite-wasm";

// Initialize global worker
await initializeSqliteWorker(SqliteWorker, true);

// Get manager
const manager = getSqliteWorkerManager();

// Get database instance
const db = manager.getDatabase("mydb");
```

**Global Functions:**
- `initializeSqliteWorker(Worker, debug?)` - Initialize the global worker
- `getSqliteWorkerManager()` - Get the global manager instance
- `isSqliteWorkerInitialized()` - Check if worker is initialized
- `resetSqliteWorkerManager()` - Reset the global manager

### Direct SQLite (Non-Worker)

#### `drizzleSqliteWasm(sqliteDb, config, debug?)`

Use SQLite WASM directly in the main thread (for testing or synchronous contexts):

```typescript
import { drizzleSqliteWasm } from "@firtoz/drizzle-sqlite-wasm";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

const sqlite3 = await sqlite3InitModule();
const sqliteDb = new sqlite3.oo1.DB("/mydb.db", "ct");

const drizzle = drizzleSqliteWasm(sqliteDb, { schema }, true);

// Use drizzle normally
const todos = await drizzle.select().from(todoTable).all();
```

### Migrations

#### `customSqliteMigrate(config)`

Run custom SQLite migrations:

```typescript
import { customSqliteMigrate } from "@firtoz/drizzle-sqlite-wasm/sqlite-wasm-migrator";

await customSqliteMigrate({
  database: sqliteDb,
  journal: journalData,
  migrations: {
    "0000_init": "CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL);",
    "0001_add_completed": "ALTER TABLE todos ADD COLUMN completed INTEGER DEFAULT 0;",
  },
  debug: true,
});
```

**Config:**
- `database: Database` - SQLite WASM database instance
- `journal: Journal` - Drizzle journal
- `migrations: Record<string, string>` - SQL migration strings
- `debug?: boolean` - Enable debug logging

## Advanced Usage

### Multiple Databases

```typescript
function App() {
  return (
    <>
      <DrizzleSqliteProvider
        worker={SqliteWorker}
        dbName="app-data"
        schema={appSchema}
        migrations={appMigrations}
      >
        <AppContent />
      </DrizzleSqliteProvider>
      
      <DrizzleSqliteProvider
        worker={SqliteWorker}
        dbName="cache-data"
        schema={cacheSchema}
        migrations={cacheMigrations}
      >
        <CacheManager />
      </DrizzleSqliteProvider>
    </>
  );
}
```

### Custom Worker Configuration

```typescript
import { initializeSqliteWorker, getSqliteWorkerManager } from "@firtoz/drizzle-sqlite-wasm";

// Initialize with custom worker
await initializeSqliteWorker(MyCustomWorker, true);

// Get manager for manual control
const manager = getSqliteWorkerManager();

// Access databases
const db1 = manager.getDatabase("app-data");
const db2 = manager.getDatabase("cache-data");
```

### Complex Queries with Drizzle

```typescript
import { eq, and, or, gt, like, desc } from "drizzle-orm";
import { todoTable } from "./schema";

function TodoComponent() {
  const { drizzle } = useDrizzleSqlite();
  
  const searchTodos = async (searchTerm: string) => {
    return await drizzle
      .select()
      .from(todoTable)
      .where(
        and(
          like(todoTable.title, `%${searchTerm}%`),
          eq(todoTable.completed, false),
          gt(todoTable.createdAt, yesterday)
        )
      )
      .orderBy(desc(todoTable.createdAt))
      .limit(10)
      .all();
  };
}
```

### Transaction Support

```typescript
function TodoComponent() {
  const { drizzle } = useDrizzleSqlite();
  
  const createTodoWithCategory = async (title: string, category: string) => {
    return await drizzle.transaction(async (tx) => {
      // Insert category if it doesn't exist
      const [existingCategory] = await tx
        .select()
        .from(categoryTable)
        .where(eq(categoryTable.name, category))
        .limit(1)
        .all();
      
      let categoryId = existingCategory?.id;
      
      if (!categoryId) {
        const [newCategory] = await tx
          .insert(categoryTable)
          .values({ name: category })
          .returning();
        categoryId = newCategory.id;
      }
      
      // Insert todo
      const [todo] = await tx
        .insert(todoTable)
        .values({ title, categoryId })
        .returning();
      
      return todo;
    });
  };
}
```

## Performance Best Practices

### 1. Use Indexes

```typescript
const todoTable = syncableTable("todos", {
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull(),
  userId: text("userId").notNull(),
}, (table) => [
  index("completed_idx").on(table.completed),
  index("user_id_idx").on(table.userId),
  index("user_completed_idx").on(table.userId, table.completed),
]);
```

### 2. Use Web Workers

Always use the Worker mode for production to keep the UI responsive:

```typescript
// ✅ Good - Non-blocking
const { drizzle } = useDrizzleSqliteDb(SqliteWorker, "mydb", schema, migrations);

// ❌ Bad - Blocks UI thread
const drizzle = drizzleSqliteWasm(sqliteDb, { schema });
```

### 3. Batch Operations

```typescript
// ✅ Good - Single transaction
await drizzle.insert(todoTable).values([
  { title: "Todo 1" },
  { title: "Todo 2" },
  { title: "Todo 3" },
]);

// ❌ Bad - Multiple transactions
for (const title of titles) {
  await drizzle.insert(todoTable).values({ title });
}
```

### 4. Use Collections for Reactive Data

```typescript
// ✅ Good - Reactive updates
const collection = useSqliteCollection("todos");
const [todos] = collection.useStore(); // Automatically updates

// ❌ Bad - Manual polling
useEffect(() => {
  const interval = setInterval(loadTodos, 1000);
  return () => clearInterval(interval);
}, []);
```

## Troubleshooting

### Worker Not Loading

**Vite:** Make sure you're using the `?worker` suffix:
```typescript
import SqliteWorker from "path/to/sqlite.worker?worker";
```

**Webpack:** Check that worker-loader is configured or use `new URL()` pattern

### Database Not Ready

Always wait for the ready promise:

```typescript
const { drizzle, readyPromise } = useDrizzleSqliteDb(/* ... */);

useEffect(() => {
  readyPromise.then(() => {
    // Now safe to query
    loadData();
  });
}, [readyPromise]);
```

### Performance Issues

- Enable debug mode to see timing: `useDrizzleSqliteDb(Worker, dbName, schema, migrations, true)`
- Check Performance tab in DevTools
- Add indexes to frequently queried columns

### Migration Errors

Check the console for specific errors. Common issues:
- Missing migration files
- Invalid SQL in migrations
- Schema conflicts

Enable debug mode for detailed logs:
```typescript
<DrizzleSqliteProvider
  worker={SqliteWorker}
  dbName="mydb"
  schema={schema}
  migrations={migrations}
  debug={true}  // Enable debug logging
>
```

## Type Utilities

Re-exported from `@firtoz/drizzle-utils`:

```typescript
import {
  syncableTable,
  makeId,
  type IdOf,
  type TableId,
  type Branded,
  type SelectSchema,
  type InsertSchema,
} from "@firtoz/drizzle-sqlite-wasm";
```

## Examples

Check out the test playground for complete examples:
- `tests/test-playground/e2e/` - E2E tests

## Dependencies

- `@firtoz/drizzle-utils`
- `@firtoz/maybe-error`
- `@firtoz/worker-helper`
- `@sqlite.org/sqlite-wasm`
- `drizzle-orm`
- `@tanstack/db`
- `react`
- `zod`

## License

MIT

## Author

Firtina Ozbalikchi <firtoz@github.com>

