---
"@firtoz/drizzle-indexeddb": minor
"@firtoz/drizzle-sqlite-wasm": minor
"@firtoz/drizzle-utils": minor
---

Add sync mode functionality for IndexedDB and SQLite collections

- Introduced support for both eager and on-demand sync modes in Drizzle providers
- Implemented operation tracking via interceptors to monitor database operations during queries
- Enhanced DrizzleIndexedDBProvider and DrizzleSqliteProvider to accept interceptors for debugging and testing purposes
- Added createInsertSchemaWithDefaults and createInsertSchemaWithIdDefault utilities for better schema management
- Refactored collection utilities to improve data handling and consistency across collections
