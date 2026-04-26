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

Lower-level helpers (for example **`broadcastSockaEventToPeers`** from **`@firtoz/socka/server`**) exist for advanced cases; prefer **`broadcastPush`** when you already have a session so schemas stay centralized.

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
