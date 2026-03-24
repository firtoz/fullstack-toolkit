# @firtoz/idb-collections

## 0.2.1

### Patch Changes

- [`bca3758`](https://github.com/firtoz/fullstack-toolkit/commit/bca3758ab5ad2661b950360dc35edda2680c3b4e) Thanks [@firtoz](https://github.com/firtoz)! - `tryExtractIndexedQuery` now resolves indexes when TanStack DB uses nested property refs (e.g. `todo.priority`) by falling back to the last path segment, matching single-column IndexedDB key paths. `extractSimpleComparisons` failures (e.g. `like`) return null without logging an error; optional debug logging uses `console.warn`.

## 0.2.0

### Minor Changes

- [`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3) Thanks [@firtoz](https://github.com/firtoz)! - New package for IndexedDB collection utilities. Provides `createKeyValCollection` and `keyvalCollectionOptions` for key-value adapter–backed TanStack DB collections, plus `tryExtractIndexedQuery` and `KeyRangeSpec` for IndexedDB query optimization.

### Patch Changes

- Updated dependencies [[`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3), [`5c667ec`](https://github.com/firtoz/fullstack-toolkit/commit/5c667ecfce1ed4f22ccf9686ad37f00e7a4ecee3)]:
  - @firtoz/db-helpers@2.0.0
