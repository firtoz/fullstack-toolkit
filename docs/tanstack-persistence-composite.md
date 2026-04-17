# TanStack DB persistence vs Drizzle-first collections (composite path)

This note supports the **Track B** direction from the TanStack 0.6 plan: keep **Drizzle** for table definitions and migrations while preferring **TanStack’s persistence stack** over bespoke “write every mutation to IndexedDB / sqlite WASM” glue where possible.

## What `@tanstack/db-sqlite-persistence-core` exposes (spike, `@tanstack/db-sqlite-persistence-core@0.1.8`)

The core package is built around:

- **`PersistenceAdapter`** — implemented by **`SQLiteCorePersistenceAdapter`** (`createSQLiteCorePersistenceAdapter`).
- **`SQLiteCoreAdapterOptions`** — `{ driver: SQLiteDriver; schemaVersion?; schemaMismatchPolicy?; … }`.
- **`SQLiteDriver`** — supplied by runtime packages (browser OPFS, Cloudflare DO, Node, etc.); the core adapter calls into it for SQL execution and transactions.

The adapter owns **TanStack’s persisted layout** (collection tables, metadata, applied tx log, indexes). It is **not** a thin wrapper around arbitrary Drizzle migrations: row bytes and metadata match what TanStack’s hydration expects.

## Implications for a Drizzle + TanStack composite

1. **Custom “Drizzle executes SQL, TanStack only tracks sync”** is only viable if you implement or wrap a **`SQLiteDriver`** (or equivalent) whose on-disk schema matches what the core adapter expects, **or** you maintain a **single** physical database whose tables satisfy both Drizzle app schema and TanStack internal tables — high coordination cost.
2. **Lower-risk near-term**: use **official** runtime adapters (`@tanstack/browser-db-sqlite-persistence`, `@tanstack/cloudflare-durable-objects-db-sqlite-persistence`, …) for **new** local-first surfaces, and keep **`@firtoz/drizzle-*`** packages for existing Drizzle-native paths until a deliberate migration.
3. **Split-brain**: avoid two different SQLite files or two competing writers for the **same** logical entities.

## Demo in this repo

See **`tests/test-playground-collections`** route **`/collections/tanstack-06-virtual-props-demo`**: `@tanstack/query-db-collection` with delayed `onInsert` + **`collection.utils.refetch()`**, live queries on **`$synced` / `$origin`**, **`createEffect`**, **`queryOnce`**, and **`toArray`** includes — without replacing Drizzle-backed collection packages.
