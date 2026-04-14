# Pushes (server-initiated)

Contracts can declare **`pushes`** alongside **`calls`**. Each push name maps to a **Standard Schema** payload. The server validates payloads **before** sending; the client decodes and validates **before** your listeners run—so **`InferSockaPushPayload`** stays honest end to end.

**Wire format** — Push uses the **`serverEvent`** logical frame type. It is encoded with the session’s **`wireFormat`** (**JSON text** or **msgpack binary**) like RPC traffic. Switching to msgpack affects **calls and pushes** together—there is no separate “push encoding.”

```ts
export const myContract = defineSocka({
  calls: { /* ... */ },
  pushes: {
    itemsChanged: z.array(messageSchema),
  },
});
```

## Server: emit and broadcast

- **`await session.emitPush("itemsChanged", payload)`** — send one **validated** push to **this** socket (typical for private notifications).
- **`await session.broadcastPush("itemsChanged", payload, excludeSelf?)`** — send to **every session in the same **`sessions`** map**, optionally skipping the caller.

Lower-level helpers (for example **`broadcastSockaEventToPeers`** from **`socka/server`**) exist for advanced cases; prefer **`broadcastPush`** when you already have a session so schemas stay centralized.

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

Use **`InferSockaPushPayload<typeof myContract, "itemsChanged">`** (from **`socka/core`**) when typing callbacks or reducers. If the server never emits a push your client subscribed to, **`waitForPush`** can time out—handle **`AbortSignal`** and UI loading states.

## Who receives `broadcastPush`?

Only sessions in the **`sessions`** map you passed into that session’s constructor.

- **Bun / Hono multi-room** — **`resolveScope`** (or per-room routes) must put each socket in the map for the right room—see **[Multi-room](./multi-room.md)**.
- **Durable Objects** — Everyone connected to **that** Durable Object instance shares one map—see **[Durable Objects](./durable-objects.md)**.

See also [Client](./client.md) and [Reference](./reference.md) for observability when push validation fails on the client.
