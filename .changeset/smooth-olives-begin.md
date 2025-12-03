---
"@firtoz/drizzle-utils": minor
---

Add external sync support and collection truncate utilities:

- **`ExternalSyncEvent`** / **`ExternalSyncHandler`** types for receiving sync events from external sources (e.g., proxy server)
- **`CollectionUtils`** interface with `truncate()` method for clearing all data from a store
- **`handleTruncate`** added to `SyncBackend` interface
- **`pushExternalSync`** exposed on `SyncFunctionResult` for pushing external sync events to collections
- `createSyncFunction` now returns `utils` with truncate functionality
