# Durable Objects

On Cloudflare **Durable Objects**, socka splits into two pieces:

1. **`SockaDoSession`** — one instance per connected **`WebSocket`**. You pass **`handlers`**, **`handleClose`**, and optional **`onAttached`**; **`broadcastPush`** uses the shared **`sessions`** map you pass into the constructor.
2. **`SockaWebSocketDO`** — subclasses **`BaseWebSocketDO`** from **`@firtoz/websocket-do`**. It connects HTTP → WebSocket upgrade → **`createSockaSession(ctx, websocket)`** so your session class gets the right **`sessions`** map and, when needed, a Hono **`Context`**.

You still define one **`defineSocka`** contract; this page is only about hosting it on a **Durable Object**.

## Cloudflare Worker checklist

This is the **Cloudflare** side (bindings, Wrangler, generated types)—not socka-specific, but you need it before **`SockaWebSocketDO`** can run.

1. **Wrangler** — `wrangler.jsonc` / `wrangler.toml` with a **Durable Object** binding and a **migration** for the DO class (see Cloudflare docs and the runnable **[tic-tac-toe-do example](https://github.com/firtoz/fullstack-toolkit/tree/main/examples/tic-tac-toe-do)** in this repo).
2. **Typed `Env`** — After you change bindings or `wrangler` config, regenerate env types (**`bun run typegen`** / **`cf-typegen`** via [`@firtoz/worker-helper`](https://github.com/firtoz/fullstack-toolkit/tree/main/packages/worker-helper)); **do not hand-edit** `worker-configuration.d.ts`. Workflow reference: [Cloudflare / Wrangler typegen skill](https://github.com/firtoz/fullstack-toolkit/blob/main/.cursor/skills/cloudflare-wrangler-typegen/SKILL.md) in this monorepo.
3. **Run locally** — `wrangler dev` (optionally pin a port—e.g. **3463** in the tic-tac-toe example so it does not clash with other apps).
4. **Peers** — **`@firtoz/socka/do`** needs **`@firtoz/websocket-do`**, **`hono`**, **`@cloudflare/workers-types`**—see **[Peers](./peers.md)**.

### Wire format

**`wireFormat`** defaults to **`"json"`** (text frames). Use **`"msgpack"`** only if the client also uses **`msgpack`**. Mismatched **`wireFormat`** between client and session config will fail to decode. Details: **[Reference — Wire encoding](./reference.md#wire-encoding-json-and-msgpack)**.

## `SockaDoSession`

```ts
import { SockaDoSession } from "@firtoz/socka/do";
import { myContract } from "./contract";

new SockaDoSession(websocket, sessions, {
  contract: myContract,
  // wireFormat: "msgpack", // optional; default JSON text — must match client
  handlers: {
    list: async (session) => fetchMessages(),
    insert: async (input, session) => saveMessage(input.message),
  },
  handleClose: async (session) => {
    // e.g. remove session.websocket from your game / presence tables
  },
});
```

Handler types use **`InferSockaHandlers<typeof myContract, SockaDoSession<typeof myContract, …>>`**. Throw **`SockaError`** for expected domain failures (bad move, permission denied) so the client receives a structured **`serverError`** frame; see **[Reference](./reference.md)** for other failure paths.

**`createData`** — If your session needs typed **`session.data`**, provide **`createData: (ctx) => …`** where **`ctx`** is a Hono **`Context`** (bindings, request, etc.). That runs when the DO accepts the socket; data participates in **hibernation** via **`@firtoz/websocket-do`** **`BaseSession`** (see **`session.update()`** below).

## `SockaWebSocketDO` and routing

Subclass **`SockaWebSocketDO`** and pass **`createSockaSession`** to connect upgrades to your session class. The base class exposes **`getBaseApp()`** for a Hono app that matches **`BaseWebSocketDO`** routing (see **`@firtoz/websocket-do`** for env typing and routes).

Minimal shape (full game example: [`examples/tic-tac-toe-do`](../../../examples/tic-tac-toe-do/src/do.ts)):

```ts
export class MyDO extends SockaWebSocketDO<MySession, Env> {
  app = this.getBaseApp();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, {
      createSockaSession: (_ctx, websocket) =>
        new MySession(websocket, this.sessions /*, … */),
    });
  }
}
```

**One Durable Object instance per room** is a common pattern: derive the DO id from your room key so each instance has its own **`sessions`** map—see **[Multi-room](./multi-room.md)**.

## Hibernation and `session.data`

After you mutate **`session.data`**, call **`await session.update()`** (from **`@firtoz/websocket-do`**) so the attachment is rewritten for **hibernation**. If you skip **`update`**, **resume** can observe stale **`session.data`**. For large or authoritative state, keep a **stable id** in **`session.data`** and use **D1 / KV / SQLite** as the source of truth—the attachment is for small, session-scoped working state.

## See also

- **[Lifecycle](./lifecycle.md)** — **`onAttached`** and **`handleClose`** ordering.
- **[Server](./server.md)** — **`attachSockaWebSocket`**, Bun, and Hono when the socket is **not** on a Durable Object.
