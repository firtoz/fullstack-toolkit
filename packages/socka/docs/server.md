# Server: Node, Bun, Hono, and ws

This guide is for a **normal WebSocket** in your own process: **Node** (including the **`ws`** package), **Bun** **`Bun.serve`**, **Hono** on Node (**`@hono/node-ws`**) or on **Cloudflare Workers** (**`hono/cloudflare-workers`**). You supply **`contract`**, **`handlers`**, and **`handleClose`**; socka decodes frames, validates inputs, and dispatches RPCs.

**Cloudflare Durable Objects** ( **`SockaDoSession`**, **`SockaWebSocketDO`** ) are covered in **[Durable Objects](./durable-objects.md)**.

With **`@firtoz/socka/server`**, pass a **`SockaWebSocketSessionConfig`** and wire the socket with **`attachSockaWebSocket`**, or call **`dispatchSockaInboundMessage`**, **`handleRawMessage`**, or **`handleBinaryMessage`** on **`SockaWebSocketSession`** yourself if you already handle **`message`** events.

### `wireFormat` and session config

The third argument to **`attachSockaWebSocket`** is a **`SockaWebSocketSessionConfig`**: at minimum **`contract`**, **`handlers`**, and **`handleClose`**. Optional **`wireFormat`** defaults to **`"json"`** (UTF-8 **text** WebSocket frames). Use **`wireFormat: "msgpack"`** only if clients use the same mode (**binary** frames). Optional **`serializeJson` / `deserializeJson`** customize JSON encoding of the **outer envelope** (not a substitute for matching `wireFormat`). Full field list: **[Reference — Server session configuration](./reference.md#server-session-configuration)**.

```ts
import {
  attachSockaWebSocket,
  type SockaWebSocketSession,
} from "@firtoz/socka/server";
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
    handleClose: async (session) => {
      // cleanup for this socket; session is still in `sessions` during the call
    },
  },
  { request: upgradeRequest },
);
```

Optional fourth argument **`{ request }`** is passed to **`createData`** when you define per-connection state. Use **`InferSockaHandlers<typeof myContract, SockaWebSocketSession<typeof myContract, YourData>>`** (or omit the second generic and let inference fill it from your handlers).

**Inbound frames without `attachSockaWebSocket`** — use **`dispatchSockaInboundMessage(session, wireFormat, data)`** with the same `data` shape as a DOM **`MessageEvent`**. See **[Internals](./internals.md)** for how this fits the wire pipeline.

## `createData` and session-only state

| | |
|---:|---|
| **`createData`** runs in the **`SockaWebSocketSession`** constructor. | By default you receive **`SockaStrictWebSocketInit`** ( **`init.request`** is the upgrade **`Request`** ). Set **`strictUpgradeRequest: false`** for **`SockaWebSocketInit`** when **`request`** may be missing. |
| **Result** is stored in **`session.data`**. | Lives in **process memory** unless you persist it yourself. |

## Strict upgrade request

**Strict vs loose:** **`SockaWebSocketSessionConfig`** (default) requires the upgrade **`Request`**. Use **`SockaWebSocketSessionConfigLoose`** with **`strictUpgradeRequest: false`** when **`init.request`** may be missing — it does not change the wire protocol, only **`createData`** typing and runtime checks.

| Mode | Type passed to **`createData`** | When to use it |
|------|----------------------------------|----------------|
| **Omitted** (default) | **`SockaStrictWebSocketInit`** — **`init.request` is always a `Request`** | Normal **Bun** / **Hono** upgrades and **`attachSockaWebSocket(..., { request })`**. **`createData`** can use **`new URL(init.request.url)`** and read headers. If the adapter omits **`request`**, socka throws at session construction. |
| **`false`** | **`SockaWebSocketInit`** — **`init.request` may be `undefined`** | Tests, **Node `ws`** without a **`Request`**, or adapters that only have a bare **`WebSocket`**. Handle a missing **`request`** in **`createData`** or omit **`createData`** usage of **`init`**. |

**Typical wiring:** Bun stores **`request`** on **`ServerWebSocket` `data`**; use **`sockaBunInitFromWsData`** (strict is the default). Hono **`sockaHonoNodeWs`** can omit **`sockaInit`** — the default builds a **`Request`** from the Hono context. See JSDoc on **`SockaWebSocketSessionConfig`**, **`SockaWebSocketInit`**, and **`SockaStrictWebSocketInit`** in **`@firtoz/socka/server`**.

Calls **with** an input schema use **`(input, session) => …`**. Calls **without** input use **`(session) => …`** only (no `undefined` first argument). When the call has **`output`** in the contract, the handler return value is validated and sent as **`serverResponse`**. When **`output` is omitted** (fire-and-forget), the handler should return **`void`**; socka sends **no** success **`serverResponse`** (failures still become **`serverError`**). See **[Reference — Optional output (fire-and-forget)](./reference.md#optional-output-fire-and-forget)** and **[Client](./client.md)**.

The **`session`** argument is the **`SockaWebSocketSession`** instance: read **`session.data`**, call **`await session.emitPush`**, **`await session.broadcastPush`** (payloads are validated against the contract **`pushes`** schemas before send).

**`onAttached`** — optional. Runs after the session is registered in the shared **`sessions`** map (safe to broadcast to peers).

**Example — `session.data`:**

```ts
import { defineSocka } from "@firtoz/socka/core";
import { SockaWebSocketSession } from "@firtoz/socka/server";
import * as z from "zod";

const gameContract = defineSocka({
  calls: {
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
  strictUpgradeRequest: false,
  createData: () => ({ health: 100 }),
  handlers: {
    getHealth: async (s) => ({ health: s.data.health }),
    damage: async (input, s) => {
      s.data.health = Math.max(0, s.data.health - input.amount);
      return { health: s.data.health };
    },
  },
  handleClose: async (session) => {
    // optional per-socket cleanup
  },
});
sessions.set(websocket, session);
```

## `@firtoz/socka/bun` (Bun.serve)

**Bun** `Bun.serve` uses **`ServerWebSocket`**, which does **not** implement **`addEventListener`**, so **`attachSockaWebSocket`** does not apply. Use **`createSockaBunWebSocketHandlers`** and pass the returned **`websocket`** into **`Bun.serve`**:

```ts
import { createSockaBunWebSocketHandlers } from "@firtoz/socka/bun";

const { websocket } = createSockaBunWebSocketHandlers({
  contract: myContract,
  handlers: { /* ... */ },
  handleClose: async (session) => {},
});

Bun.serve({ fetch, websocket });
```

**Multi-room** — use the overload **`createSockaBunWebSocketHandlers({ resolveScope })`** so each **`ServerWebSocket`** picks the correct **`sessionMap`** and shared **`config`** (see [Multi-room](./multi-room.md) and the tic-tac-toe example).

**Upgrade query params** — `createData` only sees **`init.request`** when the adapter passes it. For Bun, merge the upgrade **`Request`** into **`ServerWebSocket` `data`** so **`?name=`** and other query params are available. Prefer **`sockaBunUpgrade(server, req, { roomId })`** from **`@firtoz/socka/bun`**, which sets **`data: { …extras, request: req }`**. Alternatively call **`server.upgrade(req, { data: { roomId, request: req } })`** yourself. **`sockaBunInitFromWsData`** reads **`data.request`** and builds **`SockaWebSocketInit`** for the session constructor.

## `@firtoz/socka/hono` (Node — `@hono/node-ws`)

Use **`createNodeWebSocket`** from [**`@hono/node-ws`**](https://github.com/honojs/middleware/tree/main/packages/node-ws) with **`serve`** from **`@hono/node-server`**, then **`upgradeWebSocket(sockaHonoNodeWs({ contract, handlers, handleClose }))`**. **`sockaHonoNodeWs`** returns the callback Hono expects for **`upgradeWebSocket`**.

## `@firtoz/socka/hono/cloudflare` (Workers)

Use **`upgradeWebSocket`** from **`hono/cloudflare-workers`** with **`sockaHonoCloudflare({ contract, handlers, handleClose })`**. The session is created on the first **`onMessage`** (Workers helpers omit **`onOpen`**).

**Node with [`ws`](https://github.com/websockets/ws)** — in the **`connection`** handler, pass the socket into **`attachSockaWebSocket`**. The `ws` package’s socket is not always identical to the browser **`WebSocket`** type; if TypeScript complains, cast to the global **`WebSocket`** type your build targets. **`attachSockaWebSocket`** and **`dispatchSockaInboundMessage`** accept JSON frames delivered as UTF-8 **`ArrayBuffer`** slices (some runtimes send text that way) as well as strings.

**Integration tests in this repo:** [`tests/socka-server-test`](https://github.com/firtoz/fullstack-toolkit/tree/main/tests/socka-server-test) (Node **`ws`**, **Bun.serve**, **Hono + `@hono/node-ws`**).
