# @firtoz/idb-collections

## 0.2.2

### Patch Changes

- [#64](https://github.com/firtoz/fullstack-toolkit/pull/64) [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f) Thanks [@firtoz](https://github.com/firtoz)! - Wire `onBroadcast` callbacks in key-value collections so local insert, update, and delete mutations are emitted for external sync transports.

- [`f90479f`](https://github.com/firtoz/fullstack-toolkit/commit/f90479f263e932b39269aecce4f54dbbb7cdce3e) Thanks [@firtoz](https://github.com/firtoz)! - Align `keyvalCollectionOptions` return type with TanStack DB `CollectionConfig`’s fourth generic (`utils`), so TypeScript 7 native (`tsgo`) typechecks match `tsc` 6.

- Updated dependencies [[`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f)]:
  - @firtoz/db-helpers@2.1.0

## 0.2.1

### Patch Changes

- [`bca3758`](https://github.com/firtoz/fullstack-toolkit/commit/bca3758ab5ad2661b950360dc35edda2680c3b4e) Thanks [@firtoz](https://github.com/firtoz)! - `tryExtractIndexedQuery` now resolves indexes when TanStack DB uses nested property refs (e.g. `todo.priority`) by falling back to the last path segment, matching single-column IndexedDB key paths. `extractSimpleComparisons` failures (e.g. `like`) return null without logging an error; optional debug logging uses `console.warn`.

## 0.2.0

### Minor Changes

- [`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3) Thanks [@firtoz](https://github.com/firtoz)! - New package for IndexedDB collection utilities. Provides `createKeyValCollection` and `keyvalCollectionOptions` for key-value adapter–backed TanStack DB collections, plus `tryExtractIndexedQuery` and `KeyRangeSpec` for IndexedDB query optimization.

### Patch Changes

- Updated dependencies [[`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3), [`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3)]:
  - @firtoz/db-helpers@2.0.0
