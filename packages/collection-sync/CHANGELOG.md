# @firtoz/collection-sync

## 7.0.1

### Patch Changes

- [`43cbf3d`](https://github.com/firtoz/fullstack-toolkit/commit/43cbf3d2210a476ab7ea83f9a51b53118cf4dbed) Thanks [@firtoz](https://github.com/firtoz)! - Align with catalog dependency updates (Hono 4.12, `@hono/zod-validator` 0.8, TanStack DB 0.6.7, React 19.2.6, Valibot 1.4.1).

  - **hono-fetcher:** Strip Zod validator 400 JSON bodies from inferred route response types so `json()` matches handler payloads again.
  - **Peer ranges:** Widen minimum `@tanstack/db`, `@tanstack/react-db`, `react`, and `valibot` versions to match the workspace catalog.

- Updated dependencies [[`43cbf3d`](https://github.com/firtoz/fullstack-toolkit/commit/43cbf3d2210a476ab7ea83f9a51b53118cf4dbed)]:
  - @firtoz/db-helpers@2.2.3
  - @firtoz/websocket-do@14.0.1

## 7.0.0

### Patch Changes

- Updated dependencies [[`1656f83`](https://github.com/firtoz/fullstack-toolkit/commit/1656f8383ef99cdf698a6660789d8e42632ea69e)]:
  - @firtoz/maybe-error@1.6.2
  - @firtoz/websocket-do@14.0.0
  - @firtoz/db-helpers@2.2.2

## 6.0.3

### Patch Changes

- Updated dependencies [[`bf246d7`](https://github.com/firtoz/fullstack-toolkit/commit/bf246d7ae9c1555886d39aab56378bc024d82c14)]:
  - @firtoz/websocket-do@13.0.2

## 6.0.2

### Patch Changes

- Updated dependencies []:
  - @firtoz/websocket-do@13.0.1

## 6.0.1

### Patch Changes

- Updated dependencies [[`7c4983f`](https://github.com/firtoz/fullstack-toolkit/commit/7c4983fd27adb9709ee844547259e0f22040fded)]:
  - @firtoz/db-helpers@2.2.1
  - @firtoz/maybe-error@1.6.1

## 6.0.0

### Minor Changes

- [`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd) Thanks [@firtoz](https://github.com/firtoz)! - Publish compiled ESM and TypeScript declarations from `dist/` for each package (`tsup`, `prepack` build). `exports`, `main`, and `types` resolve to `dist/`; CLI bins point at built JS with a Node shebang where applicable. Shared `scripts/tsup-lib.ts` discovers `src` entries and externals; workspace test apps map `@firtoz/*` to package sources in `tsconfig` for accurate generics during typecheck. `@firtoz/socka` is published under the scoped name with the same `dist/` layout.

### Patch Changes

- [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe) Thanks [@firtoz](https://github.com/firtoz)! - Improve READMEs: npm shields, contextual stack badges, clearer taglines, and new docs for `@firtoz/idb-collections` and `@firtoz/collection-sync`. Align `@firtoz/db-helpers` copy with published `dist/` builds.

- Updated dependencies [[`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd), [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe)]:
  - @firtoz/db-helpers@2.2.0
  - @firtoz/maybe-error@1.6.0
  - @firtoz/websocket-do@13.0.0

## 5.0.0

### Patch Changes

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`d35e718`](https://github.com/firtoz/fullstack-toolkit/commit/d35e718bf3292258c2b0006affc7aad5ecc35208) Thanks [@firtoz](https://github.com/firtoz)! - **@firtoz/websocket-do:** Replace Zod-only `ZodSession`, `ZodWebSocketClient`, `ZodWebSocketDO`, and `zodMsgpack` with Standard Schema v1–based `StandardSchemaSession`, `StandardSchemaWebSocketClient`, `StandardSchemaWebSocketDO`, and `standardSchemaMsgpack`. Add `parseStandardSchema` and a direct dependency on `@standard-schema/spec`. Subpath `./zod-client` is removed; use `./schema-client`. Client `send` is now async (`Promise<void>`). Server session `send`/`broadcast` stay `void` with async validation under the hood. Remove the experimental `@firtoz/websocket-do/ws-rpc-protocol` export; use **`socka/core`** (`defineSocka`, typed RPC) instead.

  **@firtoz/collection-sync:** `connectSync` / `connect-partial-sync` now use `StandardSchemaWebSocketClient` from `@firtoz/websocket-do/schema-client`.

  **@firtoz/drizzle-durable-sqlite:** `SyncableDurableObject` and `QueryableDurableObject` extend `StandardSchemaWebSocketDO` / `StandardSchemaSession` and use `createStandardSchemaSession` / `standardSchemaSessionOptions` in constructors.

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`138c394`](https://github.com/firtoz/fullstack-toolkit/commit/138c3944b491ebf2e76b7f2c00d651fd5d788bac) Thanks [@firtoz](https://github.com/firtoz)! - Raise TanStack DB peer range to `>=0.6.3` where applicable. `createGenericCollectionConfig` now sets `defaultIndexType: BasicIndex` and `autoIndex: "eager"` so Drizzle-backed collections match pre-0.6 indexing defaults for `orderBy`/`limit` live queries. Re-enable `DeduplicatedLoadSubset` (`USE_DEDUPE`) with `@tanstack/db` 0.6.4.

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`d35e718`](https://github.com/firtoz/fullstack-toolkit/commit/d35e718bf3292258c2b0006affc7aad5ecc35208) Thanks [@firtoz](https://github.com/firtoz)! - Optional `createData` on `BaseSessionHandlers`: when omitted, `startFresh` initializes session `data` as `{}`.

  **@firtoz/collection-sync:** `connectSync` / `connect-partial-sync` attach error logging to async `StandardSchemaWebSocketClient.send` so outbound validation failures are not unhandled promise rejections.

- Updated dependencies [[`ffee5b3`](https://github.com/firtoz/fullstack-toolkit/commit/ffee5b313d073366a10e049dc988c9a9c95719be), [`7eb49ad`](https://github.com/firtoz/fullstack-toolkit/commit/7eb49adb100ffc5187a1f858b013b151db82643f), [`e1c08cb`](https://github.com/firtoz/fullstack-toolkit/commit/e1c08cb803574654d5808a984e358258c4171698), [`d35e718`](https://github.com/firtoz/fullstack-toolkit/commit/d35e718bf3292258c2b0006affc7aad5ecc35208), [`138c394`](https://github.com/firtoz/fullstack-toolkit/commit/138c3944b491ebf2e76b7f2c00d651fd5d788bac), [`d35e718`](https://github.com/firtoz/fullstack-toolkit/commit/d35e718bf3292258c2b0006affc7aad5ecc35208)]:
  - @firtoz/websocket-do@12.0.0
  - @firtoz/db-helpers@2.1.1

## 4.0.0

### Patch Changes

- Updated dependencies []:
  - @firtoz/websocket-do@10.0.0

## 3.0.0

### Patch Changes

- Updated dependencies []:
  - @firtoz/websocket-do@9.0.0

## 2.0.1

### Patch Changes

- Updated dependencies []:
  - @firtoz/websocket-do@8.0.1

## 2.0.0

### Patch Changes

- Updated dependencies []:
  - @firtoz/websocket-do@8.0.0

## 1.0.0

### Major Changes

- [#64](https://github.com/firtoz/fullstack-toolkit/pull/64) [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f) Thanks [@firtoz](https://github.com/firtoz)! - **Breaking:** Sync and partial-sync APIs require `PartialSyncRowShape` — every row must declare an `updatedAt` key (values may be `number`, `Date`, `null`, or `undefined` for “no watermark”). React peer dependency is now `>=19.2.4` (viewport hook uses `useEffectEvent`).

  Add `@firtoz/collection-sync` with msgpack/Zod wire schemas (including `SyncClientMessage` / `SyncServerMessage` from schema inference), full and partial client/server bridges, `connectSync` / `connectPartialSync`, `withSync`, optional `SyncStateStorage`, `collectionId` multiplexing, predicate/range/viewport helpers, React exports (`usePartialSyncWindow`, `usePartialSyncViewport`, `usePartialSyncCollection`, etc.), range reconciliation, `rangePatch` view transitions, serialized inbound handling, mutation-bridge pairing, and fixes for cache reconciliation, chunk applies, and viewport stability.

### Patch Changes

- [`afb1873`](https://github.com/firtoz/fullstack-toolkit/commit/afb187331bebb1f0231f6615c5b74989191cf30d) Thanks [@firtoz](https://github.com/firtoz)! - Align predicate row refs with TanStack DB 0.6.x: `PredicateRowRef` is now a typed query `Ref` so `inArray`/`orderBy` accept column expressions; `buildRangeConditionsAndExpression` accepts `PredicateRangeBuildRow` (refs or plain objects for tests).

- Updated dependencies [[`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f), [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f)]:
  - @firtoz/db-helpers@2.1.0
  - @firtoz/websocket-do@7.1.0
