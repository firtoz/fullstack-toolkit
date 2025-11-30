---
"@firtoz/drizzle-indexeddb": minor
---

### Breaking Changes

- Removed `migrateIndexedDB` and `IndexedDBMigrationConfig` exports - use `migrateIndexedDBWithFunctions` instead
- Removed snapshot-based migration system in favor of function-based migrations

### New Features

- Added `drizzle-indexeddb-generate` CLI tool to generate IndexedDB migration functions from Drizzle snapshots
- Added `generateIndexedDBMigrations` export for programmatic migration generation
- Added `./generate` export path

### Migration Guide

Instead of importing snapshots directly and using `migrateIndexedDB`, you now:

1. Run `bun drizzle-indexeddb-generate` (or `npx drizzle-indexeddb-generate`) after `drizzle-kit generate`
2. Import the generated migrations and use `migrateIndexedDBWithFunctions`
