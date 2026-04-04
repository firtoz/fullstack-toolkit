# @firtoz/drizzle-durable-sqlite

## 1.0.4

### Patch Changes

- Updated dependencies []:
  - @firtoz/websocket-do@10.0.0
  - @firtoz/collection-sync@4.0.0

## 1.0.3

### Patch Changes

- Updated dependencies []:
  - @firtoz/websocket-do@9.0.0
  - @firtoz/collection-sync@3.0.0

## 1.0.2

### Patch Changes

- Updated dependencies []:
  - @firtoz/websocket-do@8.0.1
  - @firtoz/collection-sync@2.0.1

## 1.0.1

### Patch Changes

- Updated dependencies []:
  - @firtoz/websocket-do@8.0.0
  - @firtoz/collection-sync@2.0.0

## 1.0.0

### Major Changes

- [#64](https://github.com/firtoz/fullstack-toolkit/pull/64) [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f) Thanks [@firtoz](https://github.com/firtoz)! - **Breaking:** Shared TanStack collection row type is `DrizzleSqliteTableCollection` from `@firtoz/drizzle-utils` — remove `DrizzleSqliteCollection` / `DurableSqliteCollection` type exports from the wasm and durable packages and import from `@firtoz/drizzle-utils` instead. Align bridge/session row types with `PartialSyncRowShape`.

  **`@firtoz/drizzle-durable-sqlite`:** `SyncableDurableObject` / `QueryableDurableObject`, Drizzle partial sync store (`createDrizzlePartialSyncStore`) with scoped `changesSince`, `getRow`, visibility and `rangeReconcile` hooks, `PartialSyncMutationHandler`, `applyDurableMutationIntents`, queued WS message handling, optional `seedInBackground`, and integration with `PartialSyncServerBridge` / `SyncServerBridge` as documented in the package.

  **`@firtoz/drizzle-sqlite-wasm`:** `createSyncedSqliteCollection`, optional `workerOpenOptions` for worker `Start` / provider hooks, table sync upsert on `id` for replayed inserts, and receive-sync persist key alignment with generic sync.

### Patch Changes

- Updated dependencies [[`afb1873`](https://github.com/firtoz/fullstack-toolkit/commit/afb187331bebb1f0231f6615c5b74989191cf30d), [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f), [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f), [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f), [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f)]:
  - @firtoz/collection-sync@1.0.0
  - @firtoz/db-helpers@2.1.0
  - @firtoz/drizzle-utils@1.2.0
  - @firtoz/websocket-do@7.1.0

## 0.2.1

### Patch Changes

- [`8b839f2`](https://github.com/firtoz/fullstack-toolkit/commit/8b839f2227f50409af649aab87178e039aad55dc) Thanks [@firtoz](https://github.com/firtoz)! - Export collection helper types for Drizzle-backed TanStack DB collections so users can declare collection variables with preserved select and insert inference from table schemas.

## 0.2.0

### Minor Changes

- [`b714ebb`](https://github.com/firtoz/fullstack-toolkit/commit/b714ebbb62ec0e3c3aa56c4105e7499fac11d1e5) Thanks [@firtoz](https://github.com/firtoz)! - Extract shared SQLite TanStack sync backend (`createSqliteTableSyncBackend`, IR→Drizzle helpers, `SQLOperation` types) into `@firtoz/drizzle-utils`. Add `@firtoz/drizzle-durable-sqlite` for Durable Object SQLite collections (`durableSqliteCollectionOptions`). Refactor `@firtoz/drizzle-sqlite-wasm` to use the shared backend with `driverMode: "async"`. `durableSqliteCollectionOptions` accepts optional `readyPromise` (defaults to immediate readiness). README documents the class-field Hono pattern, `app.fetch(request, env)` for bindings, optional `on-demand` + `preload` vs eager + `onFirstReady`, and `honoDoFetcherWithName` without a separate exported app type. Restore JSDoc on `DrizzleSqliteCollectionConfig` (`debug`, `checkpoint`, `interceptor`) for editor tooltips. Align `createStandaloneCollection` generics with `InsertToSelectSchema` from `@firtoz/drizzle-utils`.

### Patch Changes

- Updated dependencies [[`b714ebb`](https://github.com/firtoz/fullstack-toolkit/commit/b714ebbb62ec0e3c3aa56c4105e7499fac11d1e5)]:
  - @firtoz/drizzle-utils@1.1.0

## 0.1.0

Initial release: TanStack DB collection options for Drizzle on Cloudflare Durable Object SQLite.
