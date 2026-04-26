# @firtoz/socka — documentation

In-repo guides for the **[Socka](../README.md)** library (**npm** [`@firtoz/socka`](https://www.npmjs.com/package/@firtoz/socka)). These docs target **people shipping apps** with socka. For Cursor agents, see also [`../skills/`](../skills/).

| Doc | Description |
|-----|-------------|
| [Getting started](./getting-started.md) | Multi-room chat tutorial (RPC + pushes + history); links to **chatroom-*** examples |
| [React + Durable Objects](./react-durable-objects.md) | Shared `defineSocka`, `SockaWebSocketDO`, `useSockaSession`, `pushHandlers`—no casts |
| [Collaborative realtime](./collaborative-realtime.md) | Canvas / whiteboard-style contract sketch (ops, drafts, batched cursors) |
| [Peers](./peers.md) | Which dependencies to install per import path and why |
| [Multi-room](./multi-room.md) | Scopes, patterns per runtime, pitfalls |
| [Lifecycle](./lifecycle.md) | `onAttached`, inbound RPCs, `handleClose` ordering |
| [Server](./server.md) | Node `ws`, Bun, Hono, `attachSockaWebSocket`, `createData`, `session.data` |
| [Durable Objects](./durable-objects.md) | `SockaDoSession`, `SockaWebSocketDO`, routing, hibernation |
| [Client](./client.md) | `SockaSession`, React (`useSocka` / `useSockaSession`), deferred connect |
| [Reconnection](./reconnection.md) | Exponential backoff, `onReconnecting` / `onReconnected`, hydrate after reconnect |
| [Presence](./presence.md) | `listPeers`, `peerCount`, snapshot RPC + `userJoined` / `userLeft` pushes |
| [Auth](./auth.md) | Cookies, tokens, and upgrade-time authorization |
| [Recipes](./recipes.md) | Copy-paste wiring per runtime |
| [History](./history.md) | Pagination/cursor, retention, `historyCleared`-style invalidation |
| [Pushes](./pushes.md) | `emitPush` / `broadcastPush`, `session.subscribe`, ordering notes |
| [Wire format](./wire-format.md) | JSON vs msgpack tradeoffs |
| [Backpressure](./backpressure.md) | Current behavior and app-level mitigations |
| [Testing](./testing.md) | Fake `WebSocket`, handler isolation, integration fixtures |
| [Reference](./reference.md) | Configuration tables, type inference, errors, imports |
| [Internals](./internals.md) | Wire protocol details, frame kinds, source file links (contributors & curious readers) |
| [Comparison](./comparison.md) | vs DIY WS, **socket.io**, **tRPC** |

**Roadmap** — [Deferred ideas and future work](../roadmap.md).
