# Multi-room

A **room** (channel, game, namespace) is a **scope** where every client shares one **`sessionMap`** and one session **config** (the object you pass to **`attachSockaWebSocket`**, **`sockaHonoNodeWs`**, **`createSockaBunWebSocketHandlers`**, …).

If you care about **encoding** (`json` vs `msgpack`), everyone in that scope must use the same **`wireFormat`** — see **[Reference](./reference.md#wire-encoding-json-and-msgpack)** (details in **[Internals](./internals.md)**).

**Durable Objects** — Often one **Durable Object instance** per room (e.g. **`idFromName(roomId)`**), with one **`sessions`** map per instance. See **[Durable Objects](./durable-objects.md)**.

Within a scope:

- All **`WebSocket`** instances are keys in the same **`Map<WebSocket, Session>`**.
- **`broadcastPush`** (and anything else that iterates **`sessions`**) only reaches sockets in **that** map — “everyone in this room” means “every session in this scope’s map.”
- **`handleClose(session)`** runs when a socket leaves; use **`session.websocket`** and **`session.data`** for cleanup. See **[Lifecycle](./lifecycle.md)** for ordering (your handler runs **before** the socket is removed from the map).

## Choosing a pattern

| Runtime | Pattern | When it fits |
|--------|---------|----------------|
| **Bun** | **`createSockaBunWebSocketHandlers({ resolveScope })`** | One **`Bun.serve`** `websocket` handler; **`resolveScope(ws)`** returns **`{ sessionMap, config }`**—often **`registry.get(roomId)`** from **`createSockaRoomRegistry`** plus **`ws.data`** from the HTTP upgrade. |
| **Hono (Node)** | **A)** One route per room (`/ws/:roomId`) with **`getOrCreateRoom`** and **`sockaHonoNodeWs(room.config, { sessions: room.sessionMap })`**. **B)** Single upgrade route + **`resolveScope(c)`** returning **`{ sessions, config }`**. |
| **Durable Objects** | **One DO instance per room** via **`idFromName(roomId)`** (or similar). Each instance has its own **`sessions`** map. |

**Chat + persisted history (good multi-room reference):** [`chatroom-bun`](../../../examples/chatroom-bun) (SQLite), [`chatroom-hono`](../../../examples/chatroom-hono) (JSON files), [`chatroom-do`](../../../examples/chatroom-do) (Durable Object SQLite). **Games:** [`tic-tac-toe-bun`](../../../examples/tic-tac-toe-bun), [`tic-tac-toe-hono`](../../../examples/tic-tac-toe-hono), [`tic-tac-toe-do`](../../../examples/tic-tac-toe-do).

If you persist messages **per room**, keep storage keyed by **room** (or one DO per room) so history cannot leak across scopes.

## Pitfalls (for app authors)

- **Mixing rooms in one map** — If two logical rooms share a **`sessionMap`**, **`broadcastPush`** and “who’s online” can leak across rooms. Give each room its own map (or its own DO instance).
- **Mutating shared `config`** — Handlers close over **`config`**; changing a shared object inside it affects every connection using that config. Prefer immutable snapshots or a **per-room** config instance (e.g. one **`Game`** object per room).
- **Very large rooms on a Durable Object** — One DO is one isolate; huge fan-in can hit CPU or memory limits. Split traffic across multiple DOs (e.g. shard by room id) if needed.

See also [Lifecycle](./lifecycle.md) and [Server](./server.md) for **`createData`** and **`session.data`**.
