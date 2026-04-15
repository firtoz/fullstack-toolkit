# socka

![Socka — WebSocket RPC, Standard Schema](./assets/banner.png)

**Standard Schema–first WebSocket RPC** for browsers and servers.

The same contract runs on **Cloudflare Durable Objects** ([`socka/do`](./docs/durable-objects.md)), **Bun** (`socka/bun`), **Hono** (`socka/hono` on Node or Cloudflare Workers), and **regular WebSocket servers** ([`socka/server`](./docs/server.md) with **`attachSockaWebSocket`**—e.g. Node **`ws`** or any runtime that exposes a standard **`WebSocket`**).

One contract drives inferred **`session.send.*`** (client-initiated calls) and **`handlers`** on the server, socka v1 envelopes with correlation, and optional **`pushes`** (server-initiated)—without hand-rolled message unions or duplicate schema layers.

## Install

```bash
bun add socka
```

Your package manager may warn about **optional peer dependencies** until you add the packages that match your imports (e.g. **`react`** for `socka/react`, **`hono`** for `socka/hono`). That is expected—see **[Peers](./docs/peers.md)** for **pick-your-flow** `bun add` lines and the full matrix.

## Documentation

All guides live under **[`docs/`](./docs/README.md)** (getting started, adapters, multi-room, lifecycle, client, pushes, reference).

**Roadmap:** [post–v1 and deferred work](./roadmap.md).

Agent-oriented skills: [`skills/`](./skills/).

## Full-stack examples

Self-contained **tic-tac-toe** apps live under the monorepo [`examples/`](../../examples/) (same game, different servers). Pick the one that matches **your** stack:

- **Bun** (`socka/bun`) — [`tic-tac-toe-bun`](../../examples/tic-tac-toe-bun) · port **3461**
- **Hono + Node** (`socka/hono`) — [`tic-tac-toe-hono`](../../examples/tic-tac-toe-hono) · port **3462**
- **Cloudflare Durable Objects** (`socka/do`) — [`tic-tac-toe-do`](../../examples/tic-tac-toe-do) · port **3463**

Each folder is **`bun run dev`**. If you are not on Cloudflare Workers, use the Bun or Hono row; the third app is **`SockaWebSocketDO`** with **`wrangler dev`**.

## Minimal contract, client, and server

**Contract** (shared module):

```ts
import { defineSocka } from "socka/core";
import * as z from "zod";

export const myContract = defineSocka({
  calls: {
    echo: {
      input: z.object({ text: z.string() }),
      output: z.object({ text: z.string() }),
    },
  },
});
```

**Server** — Implement **`handlers`** on **`SockaWebSocketSession`** ([**Server**](./docs/server.md): **`attachSockaWebSocket`**, Bun, Hono) **or** on **`SockaDoSession`** ([**Durable Objects**](./docs/durable-objects.md)). Pick one stack; you do not wire both for the same socket.

**Client** — **`SockaSession`** with the same contract and URL:

```ts
import { SockaSession } from "socka/client";
import { myContract } from "./contract";

const session = new SockaSession({ contract: myContract, url: "wss://example.com/ws" });
// Each session.send.* awaits the socket open before sending (default autoConnect: true).
const { text } = await session.send.echo({ text: "hello" });
```

### Example: Durable Object server

**`SockaDoSession`** with **`SockaWebSocketDO`** (upgrade → **`createSockaSession`**). Full routing and hibernation: [`docs/durable-objects.md`](./docs/durable-objects.md).

```ts
import { SockaDoSession, SockaWebSocketDO } from "socka/do";
import { myContract } from "./contract";

type SessionData = Record<string, never>;

export class EchoSession extends SockaDoSession<
  typeof myContract,
  SessionData,
  Env
> {
  constructor(websocket: WebSocket, sessions: Map<WebSocket, EchoSession>) {
    super(websocket, sessions, {
      contract: myContract,
      handlers: {
        echo: async (input) => ({ text: input.text }),
      },
      handleClose: async () => {},
    });
  }
}

export class EchoDO extends SockaWebSocketDO<EchoSession, Env> {
  app = this.getBaseApp();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, {
      createSockaSession: (_ctx, websocket) =>
        new EchoSession(
          websocket,
          this.sessions,
        ),
    });
  }
}
```

**Getting started** ([`docs/getting-started.md`](./docs/getting-started.md)) walks through choosing a stack, **`bun add socka`**, and runnable demos. **[Reference](./docs/reference.md)** covers wire format and errors.

## Features

- **Schema-first** — [Standard Schema v1](https://standardschema.dev/) (Zod, Valibot, ArkType, …).
- **Typed RPC** — `session.send.echo(...)` on the client; `handlers.echo` on the server with the full **`session`**.
- **Server push** — optional contract **`pushes`** with validated **`broadcastPush`** / client **`session.subscribe`**.
- **Runtimes** — **`socka/server`** (Node **`ws`**, any standard **`WebSocket`**); **`socka/bun`**; **`socka/hono`** (Node + Workers); **`socka/do`** + **`SockaWebSocketDO`** on Cloudflare Durable Objects.
- **Multi-room** — shared config per scope; Bun **`resolveScope`**, Hono route-per-room or **`resolveScope`**, or one DO per room ([Multi-room](./docs/multi-room.md)).

## At a glance

| | |
|---:|---|
| **Docs hub** | [`docs/README.md`](./docs/README.md) |
| **Contract** | `defineSocka({ calls, pushes? })` |
| **Compared to DIY WS RPC** | [`docs/comparison.md`](./docs/comparison.md) |
