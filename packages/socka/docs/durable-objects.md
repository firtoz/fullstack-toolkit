# Durable Objects

On Cloudflare **Durable Objects**, socka splits into two pieces:

1. **`SockaDoSession`** — one instance per connected **`WebSocket`**. Handlers, **`handleClose`**, and optional **`onAttached`** live in config; **`broadcastPush`** fans out over the shared **`sessions`** map.
2. **`SockaWebSocketDO`** — subclasses **`BaseWebSocketDO`** from **`@firtoz/websocket-do`**. You declare the **`contract`** once on the DO and implement **`buildSockaSessionConfig`**; the base wires HTTP → WebSocket upgrade → **`new SockaDoSession(websocket, host)`**.

You still define one **`defineSocka`** contract; this page is only about hosting it on a **Durable Object**.

## Recommended: `SockaWebSocketDO` (default session)

Most apps do **not** need a custom **`SockaDoSession`** subclass. Extend **`SockaWebSocketDO`**, set **`contract`**, and implement **`buildSockaSessionConfig`**. Add a constructor only when you need setup beyond **`super(ctx, env)`** (for example **`ctx.blockConcurrencyWhile`** for SQLite migrations).

Runnable example: **[`examples/chatroom-do/src/do.ts`](../../../examples/chatroom-do/src/do.ts)**.

```ts
import {
  SockaWebSocketDO,
  type SockaDoSessionConfigInput,
} from "@firtoz/socka/do";
import { myContract } from "./contract";

type SessionData = { userId: string; displayName: string };

export class MyDO extends SockaWebSocketDO<
  typeof myContract,
  SessionData,
  Env
> {
  protected readonly contract = myContract;
  app = this.getBaseApp().delete("/admin/messages/:messageId", async (c) => {
    const messageId = c.req.param("messageId");
    await this.db.delete(messageId);
    await this.broadcastPushToAll("messageDeleted", { id: messageId });
    return c.json({ ok: true as const });
  });

  protected buildSockaSessionConfig(
    ctx: Context<{ Bindings: Env }> | undefined,
  ): SockaDoSessionConfigInput<typeof myContract, SessionData, Env> {
    return {
      wireFormat: "json",
      createData: (c) => ({ userId: crypto.randomUUID(), displayName: "…" }),
      handlers: {
        sendMessage: async (input, session) => {
          await this.db.insert(…);
          await session.broadcastPush("roomMessage", row);
          return { ok: true as const };
        },
      },
      handleClose: async (session) => { … },
    };
  }

  // Same logic as the HTTP route above — callable from alarms or internal helpers
  async deleteMessage(id: string) {
    await this.db.delete(…);
    await this.broadcastPushToAll("messageDeleted", { id });
  }
}
```

**`buildSockaSessionConfig`** omits **`contract`** (the DO owns it). See **[Hibernation and `session.data`](#hibernation-and-sessiondata)** for when **`ctx`** and **`createData`** run (including after hibernate resume).

## Custom `SockaDoSession` subclass (optional)

Override **`createSockaSession`** on **`SockaWebSocketDOBase`** (four type parameters) when you need a session subtype. Or construct from the host:

```ts
class MySession extends SockaDoSession<typeof myContract, SessionData, Env> {
  constructor(ws: WebSocket, do: MyDO, ctx?: Context<{ Bindings: Env }>) {
    super(ws, do, ctx);
  }
}
```

The legacy **`(websocket, sessions, config)`** constructor remains for tests and non-DO tooling.

## Cloudflare Worker checklist

This is the **Cloudflare** side (bindings, Wrangler, generated types)—not socka-specific, but you need it before **`SockaWebSocketDO`** can run.

1. **Wrangler** — `wrangler.jsonc` / `wrangler.toml` with a **Durable Object** binding and a **migration** for the DO class (see Cloudflare docs and the runnable **[tic-tac-toe-do example](https://github.com/firtoz/fullstack-toolkit/tree/main/examples/tic-tac-toe-do)** in this repo).
2. **Typed `Env`** — After you change bindings or `wrangler` config, regenerate env types (**`bun run typegen`** / **`cf-typegen`** via [`@firtoz/worker-helper`](https://github.com/firtoz/fullstack-toolkit/tree/main/packages/worker-helper)); **do not hand-edit** `worker-configuration.d.ts`. Workflow reference: [Cloudflare / Wrangler typegen skill](https://github.com/firtoz/fullstack-toolkit/blob/main/.cursor/skills/cloudflare-wrangler-typegen/SKILL.md) in this monorepo.
3. **Run locally** — `wrangler dev` (optionally pin a port—e.g. **3463** in the tic-tac-toe example so it does not clash with other apps).
4. **Peers** — **`@firtoz/socka/do`** needs **`@firtoz/websocket-do`** and **`hono`** — see **[Peers](./peers.md)**. Use **`wrangler types`** (or your app’s typegen) for Cloudflare/DO bindings in TypeScript.

### Wire format

**`wireFormat`** defaults to **`"json"`** (text frames). Use **`"msgpack"`** only if the client also uses **`msgpack`**. Mismatched **`wireFormat`** between client and session config will fail to decode. See **[Reference](./reference.md#wire-encoding-json-and-msgpack)** and **[Internals](./internals.md)**.

## `SockaDoSession` (manual wiring)

For tests or advanced cases, you can still construct a session directly:

```ts
new SockaDoSession(websocket, doHost, attachCtx);
// or
new SockaDoSession(websocket, sessions, { contract, handlers, handleClose, … });
```

Handler types use **`InferSockaHandlers<typeof myContract, SockaDoSession<typeof myContract, …>>`**. Same semantics as **`SockaWebSocketSession`**: calls **with** **`output`** get a validated **`serverResponse`**; calls **without** **`output`** are fire-and-forget on success (no success frame). Throw **`SockaError`** for expected domain failures so the client receives a structured **`serverError`** frame (with optional **`rpc`** on the wire). For client-side **`reportError`** when using output-less calls, see **[Reference](./reference.md#optional-output-fire-and-forget)** and **[Client](./client.md#fire-and-forget)**.

## Hibernation and `session.data`

**Fresh WebSocket upgrade** — **`buildSockaSessionConfig(ctx)`** runs with the Hono **`Context`**. **`createData`** runs once via **`BaseSession.startFresh(ctx)`** and can read **`ctx.req`** (query params, headers, etc.).

**Hibernation resume** — **`@firtoz/websocket-do`** calls **`createSession(undefined, websocket)`** then **`session.resume()`**, **not** **`startFresh`**. So:

- **`buildSockaSessionConfig(undefined)`** runs again to rebuild handlers (they may close over **`this`** — that is fine).
- **`createData` is not called on resume.** **`session.data`** is restored from the WebSocket attachment. Do not assume **`ctx`** exists inside **`createData`** on resume — it will not run.

If you mutate **`session.data`** after connect, call **`await session.update()`** so the attachment is rewritten before hibernate. If you skip **`update`**, resume can observe stale **`session.data`**. For large or authoritative state, keep a **stable id** in **`session.data`** and use **D1 / KV / SQLite** as the source of truth—the attachment is for small, session-scoped working state.

**One Durable Object instance per room** is a common pattern: derive the DO id from your room key so each instance has its own **`sessions`** map—see **[Multi-room](./multi-room.md)**.

## Pushes from HTTP / non-WebSocket handlers

Many DO apps expose **Hono HTTP routes** on **`app`** (admin moderation, internal APIs, alarms) in addition to **`/websocket`**. Chain routes on **`this.getBaseApp()`** — socka registers **`GET /websocket`**; your handlers share the same **`app`** instance:

```ts
app = this.getBaseApp().delete("/admin/messages/:messageId", async (c) => {
  const id = c.req.param("messageId");
  await this.db.delete(id);
  await this.broadcastPushToAll("messageDeleted", { id });
  return c.json({ ok: true as const });
});
```

After mutating storage from those handlers, **`broadcastPushToAll`** fans out to every connected client. The DO **`contract`** is the single source of truth. See **[Pushes — Pushes from HTTP / non-WebSocket handlers](./pushes.md#pushes-from-http--non-websocket-handlers)**.

Without a DO subclass, use **`broadcastContractPushToAll(this.sessions, contract, name, body)`** from **`@firtoz/socka/server`**.

## See also

- **[Lifecycle](./lifecycle.md)** — **`onAttached`** and **`handleClose`** ordering.
- **[Server](./server.md)** — **`attachSockaWebSocket`**, Bun, and Hono when the socket is **not** on a Durable Object.
