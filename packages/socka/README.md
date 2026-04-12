# socka

Standard Schema-first WebSocket RPC for browsers and Cloudflare Durable Objects.

Define your procedures with any Standard Schema v1 library (Zod, Valibot, ArkType, etc.) and get fully typed RPC methods on the client and typed handlers on the server. No adapters, no wire message unions, no boilerplate.

## Compared to the usual WebSocket RPC setup

**What’s common today:** you define client/server message shapes (often big discriminated unions with `type` + `id`), validate with Zod or similar on each side, and hand-roll correlation—allocate an id, stash a `Promise` in a `Map`, match replies by `id`, map errors yourself, and repeat for every procedure. Pushes are often separate ad hoc shapes or string event names with loosely typed payloads.

| | Typical hand-rolled WS RPC | socka |
|---|---------------------------|--------|
| **Pros** | Full control over every byte and message name; fits any host (not tied to one framing); easy to start with a single `switch (msg.type)` for a tiny app; no dependency on a shared wire spec. | One **contract** drives types end-to-end; **Standard Schema** so Zod/Valibot/ArkType plug in without adapters; **socka v1** envelopes + built-in request/response correlation; **inferred** `rpc.*` and server `handlers`—fewer `unknown` / manual casts. |
| **Cons** | Lots of boilerplate; duplicated or drifting schemas; correlation and error mapping are easy to get wrong; inference across client/server usually stops at `Promise<unknown>` unless you invest in your own types. | Opinionated **socka v1** framing (default **JSON text** frames, optional **msgpack** `ArrayBuffer` frames—both ends must use the same `wireFormat`); helpers target **browser + Cloudflare Durable Objects**—other runtimes can speak the same bytes but you bring your own session glue; you model RPC as **named procedures**, not arbitrary free-form messages. |

**When to pick which:** use hand-rolled messages if you need a legacy protocol, a custom binary layout, or maximal flexibility with zero shared library. Use socka when you want schema-first procedures, strict framing, and typed RPC without maintaining parallel type definitions and pending maps yourself.

## Install

```bash
bun add socka
```

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

  // Fully typed — no casts needed
  const items = await rpc.list();           // Promise<Message[]>
  await rpc.insert({ message: newMsg });    // Promise<void>
}

// Binary frames (must match server `wireFormat: "msgpack"`)
useSockaRpc(myContract, { url: "wss://...", wireFormat: "msgpack" }, []);
```

## Server (Cloudflare Durable Object)

```ts
import { SockaDoSession } from "socka/do";
import { myContract } from "./contract";

new SockaDoSession(websocket, sessions, {
  contract: myContract,
  // wireFormat: "msgpack", // optional; default is JSON text frames
  createData: () => ({}),
  handlers: {
    list: async () => fetchMessages(),
    insert: async (input) => saveMessage(input.message),
  },
  handleClose: async () => {},
});
```

Handlers are fully typed via `InferSockaHandlers<typeof myContract>`.

## Type inference

```ts
import type { InferSockaRpc, InferSockaHandlers } from "socka/core";

type Rpc = InferSockaRpc<typeof myContract>;
// { list: () => Promise<Message[]>; insert: (input: { message: Message }) => Promise<void> }

type Handlers = InferSockaHandlers<typeof myContract>;
// { list: () => Message[] | Promise<Message[]>; insert: (input: { message: Message }) => void | Promise<void> }
```

## Wire protocol

All frames share the same **logical** socka v1 object shape; on the wire you either send **JSON text** (default) or **msgpack** `ArrayBuffer` frames (`wireFormat: "msgpack"` on both `SockaWebSocketClient` and `SockaDoSession`). Decoding uses the same validation (`decodeSockaWire`) after `JSON.parse` or `msgpackr` unpack.

- `clientRequest`: `{ socka: "clientRequest", v: 1, id, rpc, body }`
- `serverResponse`: `{ socka: "serverResponse", v: 1, id, rpc, body }`
- `serverError`: `{ socka: "serverError", v: 1, id, error }`
- `serverEvent`: `{ socka: "serverEvent", v: 1, event, body }`

## Events (server pushes)

```ts
export const myContract = defineSocka({
  procedures: { ... },
  events: {
    itemsChanged: z.array(messageSchema),
  },
});

// Server: session.emitEvent("itemsChanged", items)
// Client: pass eventHandlers to useSockaRpc options
```

## Schema library support

Socka accepts any library that implements Standard Schema v1:

- **Zod** (v3.24+ / v4) — schemas work directly
- **Valibot** (v1+) — schemas work directly
- **ArkType** — schemas work directly
- **Custom** — implement `StandardSchemaV1` interface

No `fromZod()` or `fromValibot()` adapters needed.
