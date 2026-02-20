---
"@firtoz/drizzle-indexeddb": major
---

**IndexedDB proxy removed**

The IDB proxy layer (proxy client/server, transport, sync adapter) has been removed. Provider no longer exposes proxy sync; use native IndexedDB only.

**Upgrade:** If you were using the IDB proxy (e.g. `idb-proxy-client`, `idb-proxy-server`, `handleProxySync`, `onSyncReady`): remove that code. There is no replacement API; you implement the transport and call `receiveSync` with `SyncMessage[]` from `@firtoz/drizzle-utils` on each side.

**Remote / multi-context setup:** Use a **memory collection** (`@firtoz/db-helpers`) in the context that cannot access IndexedDB and keep the **IDB collection** where IndexedDB is available (source of truth). Implement your own channel (e.g. BroadcastChannel, `postMessage`, or WebSocket): when a context receives sync messages, call `utils.receiveSync(messages)` on its collection. Use `SyncMessage` from `@firtoz/db-helpers` (or `@firtoz/drizzle-utils`). The side that holds IDB can push initial state and updates as `SyncMessage[]` so the other side’s memory collection stays in sync.
