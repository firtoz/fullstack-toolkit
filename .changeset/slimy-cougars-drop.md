---
"@firtoz/db-helpers": patch
"@firtoz/collection-sync": patch
"@firtoz/drizzle-indexeddb": patch
"@firtoz/drizzle-utils": patch
"@firtoz/idb-collections": patch
---

Raise TanStack DB peer range to `>=0.6.3` where applicable. `createGenericCollectionConfig` now sets `defaultIndexType: BasicIndex` and `autoIndex: "eager"` so Drizzle-backed collections match pre-0.6 indexing defaults for `orderBy`/`limit` live queries. Re-enable `DeduplicatedLoadSubset` (`USE_DEDUPE`) with `@tanstack/db` 0.6.4.
