---
"@firtoz/drizzle-sqlite-wasm": major
---

**@firtoz/drizzle-sqlite-wasm:** `DrizzleSqliteProvider` now requires a `loadingFallback` and gates `children` until the worker and migrations are ready; optional `errorFallback` and `data-testid="sqlite-db-error"`. `useDrizzleSqliteDb` exposes `sessionStatus` and `sessionError` with a per-`dbName` `readyPromise`. Collections are created only in the ready subtree, with checkpoint closing over the real client (no provider checkpoint ref). Exports `DrizzleSqliteSessionStatus`. Document `key={dbName}` (or a composite) when switching databases. Removes the `drizzleCollectionOptions` entry-point alias: import `sqliteCollectionOptions` (or deep import `@firtoz/drizzle-sqlite-wasm/sqliteCollectionOptions`) instead of the former `./drizzleCollectionOptions` subpath.
