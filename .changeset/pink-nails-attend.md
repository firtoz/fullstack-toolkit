---
"@firtoz/drizzle-indexeddb": minor
---

Add `createStandaloneCollection` utility for using IndexedDB collections outside of React context.

Features:
- Simple API for standalone usage without React providers
- Async mutation methods (`insert`, `update`, `delete`, `truncate`) that return Promises
- Sync accessors (`getAll`, `get`, `isReady`)
- Full access to collection utils (`truncate`, `pushExternalSync`)
- Automatic database initialization with migration support

Also:
- Update `IndexedDbCollection` type to use `CollectionUtils` instead of generic `UtilsRecord` for proper typing of `truncate` and `pushExternalSync`
- Export `IndexedDbCollection` type from package
