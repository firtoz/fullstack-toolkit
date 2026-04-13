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
    list: async () => fetchMessages(),
    insert: async (input) => saveMessage(input.message),
  },
  handleClose: async () => {},
});
```

Handler types come from **`InferSockaHandlers<typeof myContract>`**. Throw **`SockaError`** for domain failures so the client can recognize them.

For routing WebSockets to sessions, use **`SockaWebSocketDO`** and **`createSockaSession`** — see `socka/do`.

## Server (Hono, Node `ws`, Bun — without Durable Objects)

For a **normal** [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) (no Cloudflare DO hibernation APIs), use **`socka/server`**. You pass the same **`contract`**, **`handlers`**, and **`handleClose`** as with `SockaDoSession`; wire the socket with **`attachSockaWebSocket`** or call **`handleRawMessage`** / **`handleBinaryMessage`** on **`SockaWebSocketSession`** yourself.

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
      list: async () => fetchMessages(),
      insert: async (input) => saveMessage(input.message),
    },
    handleClose: async () => {},
  },
  { request: upgradeRequest },
);
```

Optional fourth argument **`{ request }`** is passed to **`createData`** when you define per-connection state. **`InferSockaHandlers<typeof myContract>`** applies unchanged.

**Hono** — use your runtime’s WebSocket helper ([Node](https://hono.dev/docs/helpers/websocket), [Bun](https://hono.dev/docs/helpers/websocket), [Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers)) and call **`attachSockaWebSocket`** from the socket **`open`** callback (or equivalent) once you hold the **`WebSocket`** instance.

**Node with [`ws`](https://github.com/websockets/ws)** — in the **`connection`** handler, pass the socket into **`attachSockaWebSocket`**. The `ws` package’s socket is not always identical to the browser **`WebSocket`** type; if TypeScript complains, cast to the global **`WebSocket`** type your build targets, or prefer **`@hono/node-ws`** / **Bun** where the global **`WebSocket`** matches **`socka/server`** expectations. **`attachSockaWebSocket`** accepts JSON frames delivered as UTF-8 **`ArrayBuffer`** slices (some runtimes send text that way) as well as strings.

**Bun** — `Bun.serve` uses **`ServerWebSocket`**, which does **not** implement **`addEventListener`**, so **`attachSockaWebSocket`** does not apply. Create a **`SockaWebSocketSession`** in **`websocket.open`** and route **`websocket.message`** / **`close`** to **`handleRawMessage`** / **`handleBinaryMessage`** (see the **`socka-server-test`** Bun integration test in this repo).

## Events (server push)

```ts
export const myContract = defineSocka({
  procedures: { /* ... */ },
  events: {
    itemsChanged: z.array(messageSchema),
  },
});

// Server: session.emitEvent("itemsChanged", payload)
// Client: eventHandlers: { itemsChanged: (payload) => ... } on useSockaRpc / useSocka
```

## Type inference

```ts
import type { InferSockaRpc, InferSockaHandlers } from "socka/core";

type Rpc = InferSockaRpc<typeof myContract>;
type Handlers = InferSockaHandlers<typeof myContract>;
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
| **Server** | `SockaDoSession` + `SockaWebSocketDO` on Durable Objects, or **`socka/server`** on any standard WebSocket |
| **Wire** | JSON text frames by default; optional **msgpack** binary — same logical frames, both ends must use the same `wireFormat` |

**Imports**

| Path | Use for |
|------|---------|
| `socka/core` | `defineSocka`, wire helpers, `SockaError`, types |
| `socka/client` | `SockaRpc`, `SockaWebSocketClient` |
| `socka/react` | `useSocka`, `useSockaRpc`, provider + context |
| `socka/do` | `SockaDoSession`, `SockaWebSocketDO` |
| `socka/server` | `SockaWebSocketSession`, `attachSockaWebSocket` |

---

## Compared to hand-rolled WebSocket RPC

Most apps model messages as large discriminated unions (`type` + `id`), validate twice, and maintain a pending `Map` for every RPC. That works, but types drift and correlation is easy to get wrong.

| | Typical custom protocol | socka |
|---|------------------------|--------|
| **Strengths** | Total control; any framing; no shared spec | One contract drives **client + server** types; **Standard Schema** everywhere; socka v1 **envelopes** + correlation built in; inferred **`rpc`** / **`handlers`** |
| **Tradeoffs** | Boilerplate, duplicated schemas, `Promise<unknown>` unless you invest | Opinionated **socka v1** shape; **named procedures** (not a free-form message bus); first-class paths are **browser + Cloudflare DO** and **`socka/server` on a standard WebSocket** |

Use a custom protocol when you must match legacy bytes or a bespoke binary layout. Use socka when you want **schema-first RPC** with strict framing and end-to-end inference.
