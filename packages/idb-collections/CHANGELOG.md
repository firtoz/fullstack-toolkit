# @firtoz/idb-collections

## 0.3.3

### Patch Changes

- [`43cbf3d`](https://github.com/firtoz/fullstack-toolkit/commit/43cbf3d2210a476ab7ea83f9a51b53118cf4dbed) Thanks [@firtoz](https://github.com/firtoz)! - Align with catalog dependency updates (Hono 4.12, `@hono/zod-validator` 0.8, TanStack DB 0.6.7, React 19.2.6, Valibot 1.4.1).

  - **hono-fetcher:** Strip Zod validator 400 JSON bodies from inferred route response types so `json()` matches handler payloads again.
  - **Peer ranges:** Widen minimum `@tanstack/db`, `@tanstack/react-db`, `react`, and `valibot` versions to match the workspace catalog.

- Updated dependencies [[`43cbf3d`](https://github.com/firtoz/fullstack-toolkit/commit/43cbf3d2210a476ab7ea83f9a51b53118cf4dbed)]:
  - @firtoz/db-helpers@2.2.3

## 0.3.2

### Patch Changes

- Updated dependencies []:
  - @firtoz/db-helpers@2.2.2

## 0.3.1

### Patch Changes

- Updated dependencies [[`7c4983f`](https://github.com/firtoz/fullstack-toolkit/commit/7c4983fd27adb9709ee844547259e0f22040fded)]:
  - @firtoz/db-helpers@2.2.1

## 0.3.0

### Minor Changes

- [`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd) Thanks [@firtoz](https://github.com/firtoz)! - Publish compiled ESM and TypeScript declarations from `dist/` for each package (`tsup`, `prepack` build). `exports`, `main`, and `types` resolve to `dist/`; CLI bins point at built JS with a Node shebang where applicable. Shared `scripts/tsup-lib.ts` discovers `src` entries and externals; workspace test apps map `@firtoz/*` to package sources in `tsconfig` for accurate generics during typecheck. `@firtoz/socka` is published under the scoped name with the same `dist/` layout.

### Patch Changes

- [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe) Thanks [@firtoz](https://github.com/firtoz)! - Improve READMEs: npm shields, contextual stack badges, clearer taglines, and new docs for `@firtoz/idb-collections` and `@firtoz/collection-sync`. Align `@firtoz/db-helpers` copy with published `dist/` builds.

- Updated dependencies [[`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd), [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe)]:
  - @firtoz/db-helpers@2.2.0

## 0.2.3

### Patch Changes

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`138c394`](https://github.com/firtoz/fullstack-toolkit/commit/138c3944b491ebf2e76b7f2c00d651fd5d788bac) Thanks [@firtoz](https://github.com/firtoz)! - Raise TanStack DB peer range to `>=0.6.3` where applicable. `createGenericCollectionConfig` now sets `defaultIndexType: BasicIndex` and `autoIndex: "eager"` so Drizzle-backed collections match pre-0.6 indexing defaults for `orderBy`/`limit` live queries. Re-enable `DeduplicatedLoadSubset` (`USE_DEDUPE`) with `@tanstack/db` 0.6.4.

- Updated dependencies [[`138c394`](https://github.com/firtoz/fullstack-toolkit/commit/138c3944b491ebf2e76b7f2c00d651fd5d788bac)]:
  - @firtoz/db-helpers@2.1.1

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
