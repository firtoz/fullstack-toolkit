# socka

**Standard Schema–first WebSocket RPC** for browsers and [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/).

One contract describes your procedures (and optional server-push events). You get inferred **`rpc.*`** on the client, inferred **`handlers`** on the server, socka v1 envelopes with built-in correlation, and **no** hand-rolled message unions or duplicate schema layers.

## Install

```bash
bun add socka
```

**Peers (install what you use):**

| Entry | Required peers |
|--------|----------------|
| `socka/core`, `socka/client` | `@cloudflare/workers-types` (or your Workers types setup) |
| `socka/react` | `react` **≥ 18** |
| `socka/do` | **`@firtoz/websocket-do`** (same major as `socka`), `@cloudflare/workers-types`, **`hono`** |
| `socka/server` | None beyond `socka/core` (standard **`WebSocket`** + same contract types) |
| `socka/bun` | Same as `socka/server` ( **`bun-types`** for TypeScript) |
| `socka/hono` | **`hono`**, **`@hono/node-ws`**, **`@hono/node-server`**, **`ws`** (runtime + types) |
| `socka/hono/cloudflare` | **`hono`** ( **`upgradeWebSocket`** from `hono/cloudflare-workers`) |

`@firtoz/websocket-do` is marked optional on the package so browser-only clients do not install it; **Durable Object servers using `socka/do` must add it explicitly** (`bun add @firtoz/websocket-do`).

## Define a contract

```ts
import { defineSocka } from "socka/core";
import * as z from "zod";

const messageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  body: z.string(),
});

export const myContract = defineSocka({
  procedures: {
    list: {
      output: z.array(messageSchema),
    },
    insert: {
      input: z.object({ message: messageSchema }),
      output: z.void(),
    },
  },
});
```

## Client (React)

```ts
import { useSockaRpc } from "socka/react";
import { myContract } from "./contract";

function App() {
  const { ready, rpc } = useSockaRpc(myContract, { url: "ws://..." }, []);

  const items = await rpc.list();
  await rpc.insert({ message: newMsg });
}

// Binary on the wire — set the same wireFormat on the DO session
useSockaRpc(myContract, { url: "wss://...", wireFormat: "msgpack" }, []);
```

### One WebSocket for the whole tree

If many components need `rpc`, avoid calling `useSockaRpc` in each one (each call owns a connection). Mount a provider once and read the session from context:

```tsx
import { SockaRpcProvider, useSockaRpcContext } from "socka/react";
import { myContract } from "./contract";

function Layout({ roomId }: { roomId: string }) {
  return (
    <SockaRpcProvider
      contract={myContract}
      deps={[roomId]}
      url={`wss://example.com/ws/${roomId}`}
    >
      <Child />
    </SockaRpcProvider>
  );
}

function Child() {
  const { ready, rpc } = useSockaRpcContext(myContract);
  // ...
}
```

Use the **same `contract` reference** on the provider and in `useSockaRpcContext` (checked at runtime).

## Server (Cloudflare Durable Object)

```ts
import { SockaDoSession } from "socka/do";
import { myContract } from "./contract";

new SockaDoSession(websocket, sessions, {
  contract: myContract,
  // wireFormat: "msgpack", // optional; default JSON text — must match client
  handlers: {
    list: async (session) => fetchMessages(),
    insert: async (input, session) => saveMessage(input.message),
  },
  handleClose: async () => {},
});
```

Handler types come from **`InferSockaHandlers<typeof myContract, SockaDoSession<typeof myContract, …>>`**. Throw **`SockaError`** for domain failures so the client can recognize them.

For routing WebSockets to sessions, use **`SockaWebSocketDO`** and **`createSockaSession`** — see `socka/do`.

## Server (Hono, Node `ws`, Bun — without Durable Objects)

For a **normal** [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) (no Cloudflare DO hibernation APIs), use **`socka/server`**. You pass the same **`contract`**, **`handlers`**, and **`handleClose`** as with `SockaDoSession`; wire the socket with **`attachSockaWebSocket`**, or call **`dispatchSockaInboundMessage`** / **`handleRawMessage`** / **`handleBinaryMessage`** on **`SockaWebSocketSession`** yourself.

```ts
import {
  attachSockaWebSocket,
  type SockaWebSocketSession,
} from "socka/server";
import { myContract } from "./contract";

const sessions = new Map<
  WebSocket,
  SockaWebSocketSession<typeof myContract>
>();

// After the upgrade (shape depends on runtime — see below):
attachSockaWebSocket(
  websocket,
  sessions,
  {
    contract: myContract,
    handlers: {
      list: async (session) => fetchMessages(),
      insert: async (input, session) => saveMessage(input.message),
    },
    handleClose: async () => {},
  },
  { request: upgradeRequest },
);
```

Optional fourth argument **`{ request }`** is passed to **`createData`** when you define per-connection state. Use **`InferSockaHandlers<typeof myContract, SockaWebSocketSession<typeof myContract, YourData>>`** (or omit the second generic and let inference fill it from your handlers).

**Inbound frames without `attachSockaWebSocket`** — use **`dispatchSockaInboundMessage(session, wireFormat, data)`** with the same `data` shape as a DOM **`MessageEvent`** (`string`, **`ArrayBuffer`**, **`Blob`**, **`ArrayBufferView`**, or **`Buffer`** on Node/Bun). This is what **`attachSockaWebSocket`** uses internally.

### `createData` and session-only state

| Where | When `createData` runs | You receive | Stored in |
|------|-------------------------|-------------|-----------|
| **`SockaWebSocketSession`** (`socka/server`, Bun, Hono, …) | Session constructor | **`SockaWebSocketInit`** (e.g. **`{ request }`** from the upgrade) | **`session.data`** |
| **`SockaDoSession`** / **`BaseSession`** (`socka/do`, **`@firtoz/websocket-do`**) | **`startFresh(ctx)`** when the DO accepts a socket | Hono **`Context`** | **`session.data`**, also serialized to the **DO WebSocket attachment** for **hibernation** |

Procedures **with** an input schema use **`(input, session) => output`**. Procedures **without** input use **`(session) => output`** only (no `undefined` first argument). The **`session`** argument is the full **`SockaWebSocketSession`** or **`SockaDoSession`** instance, so you can read **`session.data`**, call **`await session.emitContractEvent`**, **`await session.broadcastContractEvent`** (payloads are validated against the contract event schemas before send).

**`onAttached`** — optional on **`SockaWebSocketSessionConfig`** and **`SockaDoSessionConfig`**. Runs after the session is registered in the shared map (safe to broadcast to peers). On Durable Objects, user code runs after **`startFresh`** so **`session.data`** is available (see implementation notes in `socka/do`).

**Example — `session.data` on a portable server:**

```ts
import { defineSocka } from "socka/core";
import { SockaWebSocketSession } from "socka/server";
import * as z from "zod";

const gameContract = defineSocka({
  procedures: {
    getHealth: {
      output: z.object({ health: z.number() }),
    },
    damage: {
      input: z.object({ amount: z.number() }),
      output: z.object({ health: z.number() }),
    },
  },
});

type GameData = { health: number };

const session = new SockaWebSocketSession(websocket, sessions, {
  contract: gameContract,
  createData: () => ({ health: 100 }),
  handlers: {
    getHealth: async (s) => ({ health: s.data.health }),
    damage: async (input, s) => {
      s.data.health = Math.max(0, s.data.health - input.amount);
      return { health: s.data.health };
    },
  },
  handleClose: async () => {},
});
sessions.set(websocket, session);
```

**Durable Objects (`SockaDoSession`):** use the same **`handlers`** pattern. After mutating **`session.data`**, call **`await session.update()`** (from **`@firtoz/websocket-do`**) so the attachment is rewritten for **hibernation**; otherwise **resume** can see stale values (see **`BaseSession`**). For large or authoritative state, keep a **stable id** in **`session.data`** and use **D1 / KV / SQLite** as the source of truth.

**Portable servers** — **`session.data`** is process memory unless you persist it yourself.

### `socka/bun` (Bun.serve)

**Bun** `Bun.serve` uses **`ServerWebSocket`**, which does **not** implement **`addEventListener`**, so **`attachSockaWebSocket`** does not apply. Use **`createSockaBunWebSocketHandlers`** and pass the returned **`websocket`** into **`Bun.serve`**:

```ts
import { createSockaBunWebSocketHandlers } from "socka/bun";

const { websocket } = createSockaBunWebSocketHandlers({
  contract: myContract,
  handlers: { /* ... */ },
  handleClose: async () => {},
});

Bun.serve({ fetch, websocket });
```

### `socka/hono` (Node — `@hono/node-ws`)

Use **`createNodeWebSocket`** from [**`@hono/node-ws`**](https://github.com/honojs/middleware/tree/main/packages/node-ws) with **`serve`** from **`@hono/node-server`**, then **`upgradeWebSocket(sockaHonoNodeWs({ contract, handlers, handleClose }))`**. **`sockaHonoNodeWs`** returns the callback Hono expects for **`upgradeWebSocket`**.

### `socka/hono/cloudflare` (Workers)

Use **`upgradeWebSocket`** from **`hono/cloudflare-workers`** with **`sockaHonoCloudflare({ contract, handlers, handleClose })`**. The session is created on the first **`onMessage`** (Workers helpers omit **`onOpen`**).

**Node with [`ws`](https://github.com/websockets/ws)** — in the **`connection`** handler, pass the socket into **`attachSockaWebSocket`**. The `ws` package’s socket is not always identical to the browser **`WebSocket`** type; if TypeScript complains, cast to the global **`WebSocket`** type your build targets. **`attachSockaWebSocket`** and **`dispatchSockaInboundMessage`** accept JSON frames delivered as UTF-8 **`ArrayBuffer`** slices (some runtimes send text that way) as well as strings.

**Integration tests in this repo:** [`tests/socka-server-test`](https://github.com/firtoz/fullstack-toolkit/tree/main/tests/socka-server-test) (Node **`ws`**, **Bun.serve**, **Hono + `@hono/node-ws`**), [`tests/socka-do-test`](https://github.com/firtoz/fullstack-toolkit/tree/main/tests/socka-do-test) (Durable Objects + **Hono Cloudflare Workers** WebSocket route).

## Events (server push)

```ts
export const myContract = defineSocka({
  procedures: { /* ... */ },
  events: {
    itemsChanged: z.array(messageSchema),
  },
});

// Server — contract-keyed emit (Standard Schema validation before send):
await session.broadcastContractEvent("itemsChanged", payload);

// Client — optional `eventHandlers` on SockaRpc / useSockaRpc (same as rpc.events.on(...))
// Or subscribe imperatively:
rpc.events.on("itemsChanged", (payload) => { /* ... */ });
rpc.events.once("itemsChanged", (payload) => { /* ... */ });
const payload = await rpc.events.waitForEvent("itemsChanged", {
  timeoutMs: 5000,
  signal: ac.signal,
  predicate: (p) => p.length > 0,
});
```

Use **`InferSockaEventPayload<typeof myContract, "itemsChanged">`** (from **`socka/core`**) for typed payloads.

## Deferred WebSocket connect

Use **`autoConnect: false`** on **`SockaWebSocketClient`** / **`SockaRpc`** when you want to open the socket later (e.g. after user action). Call **`await rpc.connect()`** or **`await client.connect()`** before RPCs; **`SockaRpc`** **`call()`** also awaits connect automatically.

## Type inference

```ts
import type { InferSockaRpc, InferSockaHandlers } from "socka/core";

type Rpc = InferSockaRpc<typeof myContract>;
type Handlers = InferSockaHandlers<
  typeof myContract,
  SockaWebSocketSession<typeof myContract>
>;
```

## Wire protocol

Every frame is one logical socka **v1** object. **`decodeSockaWire`** validates shape after `JSON.parse` (text) or msgpack unpack (binary).

| Kind | Role |
|------|------|
| `clientRequest` | Client → server RPC (`id`, `rpc`, `body`) |
| `serverResponse` | Success reply |
| `serverError` | Correlated failure (`id`, `error`) |
| `serverEvent` | Server push (`event`, `body`) |

## Schema libraries

Anything that implements **Standard Schema v1** works — **Zod**, **Valibot**, **ArkType**, or a custom implementation. Pass schemas straight into **`defineSocka`**; no adapter helpers required.

---

## At a glance

| | |
|---:|---|
| **Contract** | `defineSocka({ procedures, events? })` — Zod, Valibot, ArkType, or any [Standard Schema v1](https://standardschema.dev/) |
| **Client** | `SockaRpc` / `useSockaRpc` / `SockaRpcProvider` + `useSockaRpcContext` |
| **Server** | `SockaDoSession` + `SockaWebSocketDO` on Durable Objects, or **`socka/server`** / **`socka/bun`** / **`socka/hono`** on any supported runtime |
| **Wire** | JSON text frames by default; optional **msgpack** binary — same logical frames, both ends must use the same `wireFormat` |

**Imports**

| Path | Use for |
|------|---------|
| `socka/core` | `defineSocka`, wire helpers, `SockaError`, types |
| `socka/client` | `SockaRpc`, `SockaWebSocketClient` |
| `socka/react` | `useSocka`, `useSockaRpc`, provider + context |
| `socka/do` | `SockaDoSession`, `SockaWebSocketDO` |
| `socka/server` | `SockaWebSocketSession`, `attachSockaWebSocket`, `dispatchSockaInboundMessage`, `broadcastSockaEventToPeers` |
| `socka/bun` | `createSockaBunWebSocketHandlers` for **`Bun.serve`** |
| `socka/hono` | `sockaHonoNodeWs` for **`@hono/node-ws`** |
| `socka/hono/cloudflare` | `sockaHonoCloudflare` for **`hono/cloudflare-workers`** |

---

## Compared to hand-rolled WebSocket RPC

Most apps model messages as large discriminated unions (`type` + `id`), validate twice, and maintain a pending `Map` for every RPC. That works, but types drift and correlation is easy to get wrong.

| | Typical custom protocol | socka |
|---|------------------------|--------|
| **Strengths** | Total control; any framing; no shared spec | One contract drives **client + server** types; **Standard Schema** everywhere; socka v1 **envelopes** + correlation built in; inferred **`rpc`** / **`handlers`** |
| **Tradeoffs** | Boilerplate, duplicated schemas, `Promise<unknown>` unless you invest | Opinionated **socka v1** shape; **named procedures** (not a free-form message bus); first-class paths are **browser + Cloudflare DO** and **`socka/server` on a standard WebSocket** |

Use a custom protocol when you must match legacy bytes or a bespoke binary layout. Use socka when you want **schema-first RPC** with strict framing and end-to-end inference.
