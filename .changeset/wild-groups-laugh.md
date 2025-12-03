---
"@firtoz/drizzle-indexeddb": minor
---

Add IDB Proxy system for multi-client IndexedDB sync over messaging layers:

**New Proxy Module** (`@firtoz/drizzle-indexeddb/proxy`):
- **`IDBProxyServer`** - Server that manages database lifecycle, migrations, and broadcasts mutations to connected clients
- **`IDBProxyClient`** - Client implementing `IDBDatabaseLike`, routing operations through a transport layer
- **`createMultiClientTransport()`** - In-memory transport for testing N clients connected to one server
- **`createProxyDbCreator()`** - Factory to create `dbCreator` for `DrizzleIndexedDBProvider`
- **`createCollectionSyncHandler()`** - Adapter connecting proxy sync messages to collection's external sync

**Real-time Multi-Client Sync**:
- Server broadcasts `sync:add`, `sync:put`, `sync:delete`, `sync:clear` messages to all clients (excluding initiator)
- All mutations automatically sync across connected clients

**Provider Enhancements**:
- New `onSyncReady` prop for wiring up external sync handlers
- `handleProxySync` method routes sync messages to the appropriate collection

**Collection Truncate**:
- `collection.utils.truncate()` clears all data and syncs to other clients
- `handleTruncate` implemented in IndexedDB backend

**Bug Fixes**:
- Server handles concurrent database initialization requests (race condition fix)
