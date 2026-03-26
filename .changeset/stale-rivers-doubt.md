---
"@firtoz/drizzle-utils": minor
"@firtoz/drizzle-sqlite-wasm": patch
"@firtoz/drizzle-durable-sqlite": minor
"@firtoz/drizzle-indexeddb": patch
---

Extract shared SQLite TanStack sync backend (`createSqliteTableSyncBackend`, IR→Drizzle helpers, `SQLOperation` types) into `@firtoz/drizzle-utils`. Add `@firtoz/drizzle-durable-sqlite` for Durable Object SQLite collections (`durableSqliteCollectionOptions`). Refactor `@firtoz/drizzle-sqlite-wasm` to use the shared backend with `driverMode: "async"`. `durableSqliteCollectionOptions` accepts optional `readyPromise` (defaults to immediate readiness). README documents the class-field Hono pattern, `app.fetch(request, env)` for bindings, optional `on-demand` + `preload` vs eager + `onFirstReady`, and `honoDoFetcherWithName` without a separate exported app type. Restore JSDoc on `DrizzleSqliteCollectionConfig` (`debug`, `checkpoint`, `interceptor`) for editor tooltips. Align `createStandaloneCollection` generics with `InsertToSelectSchema` from `@firtoz/drizzle-utils`.
