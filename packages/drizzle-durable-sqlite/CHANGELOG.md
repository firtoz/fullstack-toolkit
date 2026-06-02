# @firtoz/drizzle-durable-sqlite

## 3.0.4

### Patch Changes

- Updated dependencies []:
  - @firtoz/websocket-do@14.0.2
  - @firtoz/collection-sync@7.0.2

## 3.0.3

### Patch Changes

- [`43cbf3d`](https://github.com/firtoz/fullstack-toolkit/commit/43cbf3d2210a476ab7ea83f9a51b53118cf4dbed) Thanks [@firtoz](https://github.com/firtoz)! - Align with catalog dependency updates (Hono 4.12, `@hono/zod-validator` 0.8, TanStack DB 0.6.7, React 19.2.6, Valibot 1.4.1).

  - **hono-fetcher:** Strip Zod validator 400 JSON bodies from inferred route response types so `json()` matches handler payloads again.
  - **Peer ranges:** Widen minimum `@tanstack/db`, `@tanstack/react-db`, `react`, and `valibot` versions to match the workspace catalog.

- Updated dependencies [[`43cbf3d`](https://github.com/firtoz/fullstack-toolkit/commit/43cbf3d2210a476ab7ea83f9a51b53118cf4dbed)]:
  - @firtoz/collection-sync@7.0.1
  - @firtoz/db-helpers@2.2.3
  - @firtoz/drizzle-utils@1.3.3
  - @firtoz/websocket-do@14.0.1

## 3.0.2

### Patch Changes

- Updated dependencies [[`1656f83`](https://github.com/firtoz/fullstack-toolkit/commit/1656f8383ef99cdf698a6660789d8e42632ea69e)]:
  - @firtoz/maybe-error@1.6.2
  - @firtoz/websocket-do@14.0.0
  - @firtoz/collection-sync@7.0.0
  - @firtoz/db-helpers@2.2.2
  - @firtoz/drizzle-utils@1.3.2

## 3.0.1

### Patch Changes

- Updated dependencies [[`bf246d7`](https://github.com/firtoz/fullstack-toolkit/commit/bf246d7ae9c1555886d39aab56378bc024d82c14)]:
  - @firtoz/websocket-do@13.0.2
  - @firtoz/collection-sync@6.0.3

## 3.0.0

### Major Changes

- [`1e057aa`](https://github.com/firtoz/fullstack-toolkit/commit/1e057aad4b252223f4269a9bc6bd01a744cf56a8) Thanks [@firtoz](https://github.com/firtoz)! - **@firtoz/router-toolkit:** Stop re-exporting `@firtoz/maybe-error` from the package entry so `.d.ts` matches runtime. `@firtoz/maybe-error` is now a regular dependency; import `success`, `fail`, `MaybeError`, `exhaustiveGuard`, and related symbols from `@firtoz/maybe-error` directly.

  **@firtoz/hono-fetcher** and **@firtoz/worker-helper:** Regenerate root `index.d.ts` after tsup so type-only symbols use `export type { ... }`, for compatibility with stricter consumer compiler settings.

  **@firtoz/drizzle-sqlite-wasm:** Remove re-exports of `@firtoz/drizzle-utils` (`syncableTable`, `makeId`, branded/schema types, `SQLOperation`, `SQLInterceptor`) from the package entry. Import those from `@firtoz/drizzle-utils` directly.

  **@firtoz/drizzle-durable-sqlite:** Stop re-exporting `SQLOperation` and `SQLInterceptor` from the package entry; import them from `@firtoz/drizzle-utils` when needed.

### Patch Changes

- Updated dependencies []:
  - @firtoz/websocket-do@13.0.1
  - @firtoz/collection-sync@6.0.2

## 2.1.1

### Patch Changes

- Updated dependencies [[`7c4983f`](https://github.com/firtoz/fullstack-toolkit/commit/7c4983fd27adb9709ee844547259e0f22040fded)]:
  - @firtoz/drizzle-utils@1.3.1
  - @firtoz/db-helpers@2.2.1
  - @firtoz/maybe-error@1.6.1
  - @firtoz/collection-sync@6.0.1

## 2.1.0

### Minor Changes

- [`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd) Thanks [@firtoz](https://github.com/firtoz)! - Publish compiled ESM and TypeScript declarations from `dist/` for each package (`tsup`, `prepack` build). `exports`, `main`, and `types` resolve to `dist/`; CLI bins point at built JS with a Node shebang where applicable. Shared `scripts/tsup-lib.ts` discovers `src` entries and externals; workspace test apps map `@firtoz/*` to package sources in `tsconfig` for accurate generics during typecheck. `@firtoz/socka` is published under the scoped name with the same `dist/` layout.

### Patch Changes

- [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe) Thanks [@firtoz](https://github.com/firtoz)! - Improve READMEs: npm shields, contextual stack badges, clearer taglines, and new docs for `@firtoz/idb-collections` and `@firtoz/collection-sync`. Align `@firtoz/db-helpers` copy with published `dist/` builds.

- Updated dependencies [[`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd), [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe)]:
  - @firtoz/collection-sync@6.0.0
  - @firtoz/db-helpers@2.2.0
  - @firtoz/drizzle-utils@1.3.0
  - @firtoz/maybe-error@1.6.0
  - @firtoz/websocket-do@13.0.0

## 2.0.0

### Major Changes

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`e1c08cb`](https://github.com/firtoz/fullstack-toolkit/commit/e1c08cb803574654d5808a984e358258c4171698) Thanks [@firtoz](https://github.com/firtoz)! - **@firtoz/websocket-do:** `BaseSessionHandlers.handleClose` and `StandardSchemaSessionHandlers.handleClose` receive the session instance (aligned with DO teardown).

  **@firtoz/drizzle-durable-sqlite:** `handleClose` handlers on bundled DO session wiring match the session-aware `BaseSession` contract.

### Patch Changes

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`d35e718`](https://github.com/firtoz/fullstack-toolkit/commit/d35e718bf3292258c2b0006affc7aad5ecc35208) Thanks [@firtoz](https://github.com/firtoz)! - **@firtoz/websocket-do:** Replace Zod-only `ZodSession`, `ZodWebSocketClient`, `ZodWebSocketDO`, and `zodMsgpack` with Standard Schema v1–based `StandardSchemaSession`, `StandardSchemaWebSocketClient`, `StandardSchemaWebSocketDO`, and `standardSchemaMsgpack`. Add `parseStandardSchema` and a direct dependency on `@standard-schema/spec`. Subpath `./zod-client` is removed; use `./schema-client`. Client `send` is now async (`Promise<void>`). Server session `send`/`broadcast` stay `void` with async validation under the hood. Remove the experimental `@firtoz/websocket-do/ws-rpc-protocol` export; use **`socka/core`** (`defineSocka`, typed RPC) instead.

  **@firtoz/collection-sync:** `connectSync` / `connect-partial-sync` now use `StandardSchemaWebSocketClient` from `@firtoz/websocket-do/schema-client`.

  **@firtoz/drizzle-durable-sqlite:** `SyncableDurableObject` and `QueryableDurableObject` extend `StandardSchemaWebSocketDO` / `StandardSchemaSession` and use `createStandardSchemaSession` / `standardSchemaSessionOptions` in constructors.

- Updated dependencies [[`ffee5b3`](https://github.com/firtoz/fullstack-toolkit/commit/ffee5b313d073366a10e049dc988c9a9c95719be), [`7eb49ad`](https://github.com/firtoz/fullstack-toolkit/commit/7eb49adb100ffc5187a1f858b013b151db82643f), [`e1c08cb`](https://github.com/firtoz/fullstack-toolkit/commit/e1c08cb803574654d5808a984e358258c4171698), [`d35e718`](https://github.com/firtoz/fullstack-toolkit/commit/d35e718bf3292258c2b0006affc7aad5ecc35208), [`138c394`](https://github.com/firtoz/fullstack-toolkit/commit/138c3944b491ebf2e76b7f2c00d651fd5d788bac), [`d35e718`](https://github.com/firtoz/fullstack-toolkit/commit/d35e718bf3292258c2b0006affc7aad5ecc35208)]:
  - @firtoz/websocket-do@12.0.0
  - @firtoz/collection-sync@5.0.0
  - @firtoz/db-helpers@2.1.1
  - @firtoz/drizzle-utils@1.2.1

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
