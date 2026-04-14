# Multi-room

A **room** (channel, game, namespace) is a **scope** where every client shares one **`sessionMap`** and one session **config** (the object you pass to **`attachSockaWebSocket`**, **`sockaHonoNodeWs`**, **`createSockaBunWebSocketHandlers`**, …).

That shared **config** includes **`wireFormat`** (`"json"` or `"msgpack"`). Everyone connecting into that scope must use the same encoding—see **[Reference — Wire encoding](./reference.md#wire-encoding-json-and-msgpack)**.

**Durable Objects** — Often one **Durable Object instance** per room (e.g. **`idFromName(roomId)`**), with one **`sessions`** map per instance. See **[Durable Objects](./durable-objects.md)**.

Within a scope:

- All **`WebSocket`** instances are keys in the same **`Map<WebSocket, Session>`**.
- **`broadcastContractEvent`** walks that map, so “everyone in this room” means “every session in this scope’s map.”
- **`handleClose(session)`** runs when a socket leaves; use **`session.websocket`** and **`session.data`** for cleanup. See **[Lifecycle](./lifecycle.md)** for ordering (your handler runs **before** the socket is removed from the map).

## Choosing a pattern

| Runtime | Pattern | When it fits |
|--------|---------|----------------|
| **Bun** | **`createSockaBunWebSocketHandlers({ resolveScope })`** | One **`Bun.serve`** `websocket` handler; **`resolveScope(ws)`** returns **`{ sessionMap, config }`**—often from **`ws.data`** set during the HTTP upgrade. |
| **Hono (Node)** | **A)** One route per room (`/ws/:roomId`) with **`getOrCreateRoom`** and **`sockaHonoNodeWs(room.config, { sessions: room.sessionMap })`**. **B)** Single upgrade route + **`resolveScope(c)`** returning **`{ sessions, config }`**. |
| **Durable Objects** | **One DO instance per room** via **`idFromName(roomId)`** (or similar). Each instance has its own **`sessions`** map. |

Demos: [`tic-tac-toe-bun`](../../../examples/tic-tac-toe-bun), [`tic-tac-toe-hono`](../../../examples/tic-tac-toe-hono), [`tic-tac-toe-do`](../../../examples/tic-tac-toe-do).

## Pitfalls

- **Mixing rooms in one map** — Two logical rooms sharing a **`sessionMap`** leak broadcasts and presence. Partition maps per room or use separate DO instances.
- **Stale `config`** — Handlers close over **`config`**; mutating shared objects inside it affects every connection using that config. Prefer immutable snapshots or room-scoped instances (e.g. one **`Game`** per room).
- **Very large rooms on a Durable Object** — One DO is one isolate; huge fan-in can hit limits. Shard by room id (multiple DOs) if needed.

See also [Lifecycle](./lifecycle.md) and [Server](./server.md) for **`createData`** and **`session.data`**.
