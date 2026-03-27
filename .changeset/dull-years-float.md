---
"@firtoz/collection-sync": minor
"@firtoz/drizzle-durable-sqlite": minor
"@firtoz/websocket-do": patch
---

Add `withSync` and `connectSync` helpers for TanStack DB collections; extend `SyncServerBridge` with `pushServerChanges` and `broadcastAll`. Add `SyncableDurableObject` base class for Durable Object SQLite sync. Fix msgpack WebSocket sends to use `Uint8Array` for `WebSocket.send` compatibility.
