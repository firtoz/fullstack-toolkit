---
"@firtoz/drizzle-utils": minor
"@firtoz/drizzle-sqlite-wasm": major
"@firtoz/drizzle-durable-sqlite": major
"@firtoz/collection-sync": patch
---

Export `DrizzleSqliteTableCollection` from `@firtoz/drizzle-utils` as the shared TanStack `Collection<>` row type for Drizzle-backed SQLite tables. Remove `DrizzleSqliteCollection` from `@firtoz/drizzle-sqlite-wasm` and `DurableSqliteCollection` from `@firtoz/drizzle-durable-sqlite`; import `DrizzleSqliteTableCollection` from `@firtoz/drizzle-utils` instead.

In `@firtoz/collection-sync`, add pluggable `SyncStateStorage` (with optional `getBrowserLocalStorageSyncStateStorage()` default) for persisted sync state so callers can use `localStorage`, `sessionStorage`, or custom backends; default remains browser `localStorage` when available and typechecks in Worker-only TypeScript configs.
