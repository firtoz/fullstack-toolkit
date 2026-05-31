# Pushes (server-initiated)

Contracts can declare **`pushes`** alongside **`calls`**. Each push name maps to a **Standard Schema** payload. The server validates payloads **before** sending; the client decodes and validates **before** your listeners run—so **`InferSockaPushPayload`** stays honest end to end.

Pushes use the same **`wireFormat`** as RPCs for that session (default JSON). **Details:** **[Reference](./reference.md#wire-encoding-json-and-msgpack)** · **[Internals](./internals.md)**.

```ts
export const myContract = defineSocka({
  calls: { /* ... */ },
  pushes: {
    itemsChanged: z.array(messageSchema),
  },
});
```

## Typing `pushHandlers`

On **`SockaSession`** and **`useSockaSession`**, the **`pushHandlers`** option is **`Partial<InferSockaPushHandlers<typeof myContract>>`**. You can use **`satisfies`** to check an object literal without changing its inferred payload types (payloads for each key still narrow from the contract):

```ts
import type { InferSockaPushHandlers } from "@firtoz/socka/core";
import { myContract } from "./contract";

const pushHandlers = {
  itemsChanged: (payload) => {
    // `payload` is typed from the contract
  },
} satisfies Partial<InferSockaPushHandlers<typeof myContract>>;
```

Types are exported from **`@firtoz/socka/core`** (same as **`@firtoz/socka`**) — see **[Reference — Type inference](./reference.md#type-inference)**.

## Server: emit and broadcast

- **`await session.emitPush("itemsChanged", payload)`** — send one **validated** push to **this** socket (typical for private notifications).
- **`await session.broadcastPush("itemsChanged", payload, excludeSelf?)`** — send to **every session in the same **`sessions`** map**, optionally skipping the caller.

### Pushes from HTTP / non-WebSocket handlers

When the origin is **not** a connected client (admin HTTP routes on the DO Hono `app`, alarms, cron, service bindings), there is no WebSocket session to call **`broadcastPush`** on.

- **`await this.broadcastPushToAll("itemsChanged", payload)`** on **`SockaWebSocketDO`** — validates against the DO **`contract`** and fans out to **every** session in **`this.sessions`**. No **`excludeSelf`**, no anchor session. No-op when the room is empty.
- **`await broadcastContractPushToAll(sessions, contract, name, body)`** from **`@firtoz/socka/server`** — same semantics when you have the shared **`sessions`** map and contract but are not inside a **`SockaWebSocketDO`** subclass.

Pass **`contract`** on the DO (`protected readonly contract = myContract`) so **`broadcastPushToAll`** stays typed and validated — see **[Durable Objects](./durable-objects.md)**.

**Do not** loop over **`sessions`** and call **`broadcastPush`** on each session — **`broadcastPush`** already iterates the whole map once. A loop would multiply traffic if every iteration ran a full fan-out.

**Do not** pick an arbitrary session (for example **`sessions.values().next().value`**) as an anchor for room-wide pushes — that reads like a bug and is easy to misuse with **`excludeSelf: true`**.

Lower-level helpers (for example **`broadcastSockaEventToPeers`** / **`broadcastSockaEventToAll`** from **`@firtoz/socka/server`**) exist for advanced cases; prefer **`broadcastPushToAll`** or **`broadcastContractPushToAll`** so schemas stay centralized.

**Ordering** — Delivery order is per connection; there is no cross-client guarantee beyond your own handler ordering. For causal ordering across clients, include a **version** or **timestamp** in the payload.

## Client: `session.subscribe`

```ts
// Optional `pushHandlers` on SockaSession / useSockaSession (same as session.subscribe.on(...))
// Or subscribe imperatively:
session.subscribe.on("itemsChanged", (payload) => { /* ... */ });
session.subscribe.once("itemsChanged", (payload) => { /* ... */ });
const payload = await session.subscribe.waitForPush("itemsChanged", {
  timeoutMs: 5000,
  signal: ac.signal,
  predicate: (p) => p.length > 0,
});
```

Use **`InferSockaPushPayload<typeof myContract, "itemsChanged">`** (from **`@firtoz/socka/core`**) when typing callbacks or reducers one-off. For tables of handlers, prefer **`InferSockaPushHandlers`** (see [Typing `pushHandlers`](#typing-pushhandlers) above). If the server never emits a push your client subscribed to, **`waitForPush`** can time out—handle **`AbortSignal`** and UI loading states.

## Who receives `broadcastPush`?

Only sessions in the **`sessions`** map you passed into that session’s constructor.

- **Bun / Hono multi-room** — **`resolveScope`** (or per-room routes) must put each socket in the map for the right room—see **[Multi-room](./multi-room.md)**.
- **Durable Objects** — Everyone connected to **that** Durable Object instance shares one map—see **[Durable Objects](./durable-objects.md)**.

See also [Client](./client.md) and [Reference](./reference.md) for observability when push validation fails on the client.
