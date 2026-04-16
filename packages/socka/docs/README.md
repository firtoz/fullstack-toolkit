# @firtoz/socka — documentation

In-repo guides for the **[Socka](../README.md)** library (**npm** [`@firtoz/socka`](https://www.npmjs.com/package/@firtoz/socka)). These docs target **people shipping apps** with socka. For Cursor agents, see also [`../skills/`](../skills/).

| Doc | Description |
|-----|-------------|
| [Getting started](./getting-started.md) | Pick a runtime, shared contract + client, wire the server, tic-tac-toe demos |
| [Peers](./peers.md) | Which dependencies to install per import path and why |
| [Multi-room](./multi-room.md) | Scopes, patterns per runtime, pitfalls |
| [Lifecycle](./lifecycle.md) | `onAttached`, inbound RPCs, `handleClose` ordering |
| [Server](./server.md) | Node `ws`, Bun, Hono, `attachSockaWebSocket`, `createData`, `session.data` |
| [Durable Objects](./durable-objects.md) | `SockaDoSession`, `SockaWebSocketDO`, routing, hibernation |
| [Client](./client.md) | `SockaSession`, React, deferred connect, reconnect |
| [Pushes](./events.md) | `emitPush` / `broadcastPush`, `session.subscribe`, ordering notes |
| [Reference](./reference.md) | Configuration tables, type inference, errors, imports |
| [Internals](./internals.md) | Wire protocol details, frame kinds, source file links (contributors & curious readers) |
| [Comparison](./comparison.md) | vs DIY WS, **socket.io**, **tRPC** |

**Roadmap** — [Deferred and post–v1 ideas](../roadmap.md).
