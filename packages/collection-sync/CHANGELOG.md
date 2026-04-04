# @firtoz/collection-sync

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
