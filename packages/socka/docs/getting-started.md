# Getting started

The **[README](../README.md)** shows the **smallest** client path: a shared **`defineSocka`** contract and **`SockaSession`**. This page continues from there: **install → same contract → wire the server** for the stack you chose, then run a runnable demo.

## What socka is

**socka** is **schema-first WebSocket RPC**: one **`defineSocka`** contract gives you typed **`session.send.*`** in the browser and **`handlers`** on the server, with socka **v1** frames on the wire. You pick **how** the socket is upgraded—Bun, Hono, Node **`ws`**, Cloudflare **Durable Objects**—and use the matching subpath from the table below.

For frame shapes and options, see **[Reference](./reference.md)**.

## Step 1 — Choose your WebSocket stack

| You want to… | Read this first | Import path |
|--------------|-----------------|-------------|
| **Node** + **`ws`**, or any standard **`WebSocket`** after upgrade | **[Server](./server.md)** — **`attachSockaWebSocket`** | `@firtoz/socka/server` |
| **Bun** **`Bun.serve`** / **`ServerWebSocket`** | **[Server](./server.md)** — **`@firtoz/socka/bun`** | `@firtoz/socka/bun` |
| **Hono** on **Node** (`@hono/node-ws`) | **[Server](./server.md)** — **`sockaHonoNodeWs`** | `@firtoz/socka/hono` |
| **Hono** on **Cloudflare Workers** | **[Server](./server.md)** — **`sockaHonoCloudflare`** | `@firtoz/socka/hono/cloudflare` |
| **Cloudflare Durable Objects** | **[Durable Objects](./durable-objects.md)** | `@firtoz/socka/do` |

**Multiple rooms or scopes?** See **[Multi-room](./multi-room.md)**.

## Step 2 — Install

```bash
npm install @firtoz/socka
```

Add **only** the peers for the subpaths you import—**[Peers](./peers.md)**.

## Step 3 — Shared contract (same as the README)

Use one module for client and server. This matches the **[README](../README.md)** hero example:

```ts
import { defineSocka } from "@firtoz/socka/core";
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

For richer examples (list/insert, optional inputs), see **[Server](./server.md)** and the tic-tac-toe apps under `examples/`.

## Step 4 — Wire the server, then the client

You already have the **client** shape from the README (`SockaSession` with the same contract). Now:

1. **Server** — Open the guide from **Step 1** and implement **`handlers`** + **`handleClose`** for **`myContract`**. Use **`SockaWebSocketSession`** / **`attachSockaWebSocket`** (Node/Bun/Hono) or **`SockaDoSession`** / **`SockaWebSocketDO`** (Durable Objects).
2. **Client** — Keep **`SockaSession`** (or **`useSockaSession`** / **`SockaSessionProvider`**—**[Client](./client.md)**) with the **same** **`wireFormat`** as the server.

### Wire format (short)

Default is **JSON text** frames. **`wireFormat: "msgpack"`** must match on **both** sides. Details: **[Reference — Wire encoding](./reference.md#wire-encoding-json-and-msgpack)**.

## Step 5 — Run a full-stack demo

Same **tic-tac-toe** contract and game logic, three servers in this repo:

| Stack | Folder | Port |
|-------|--------|------|
| **Bun** | [`tic-tac-toe-bun`](../../../examples/tic-tac-toe-bun) | **3461** |
| **Hono + Node** | [`tic-tac-toe-hono`](../../../examples/tic-tac-toe-hono) | **3462** |
| **Durable Objects** | [`tic-tac-toe-do`](../../../examples/tic-tac-toe-do) | **3463** |

From the folder: **`bun run dev`**. The DO example uses **`wrangler dev`**.

---

Next: [Peers](./peers.md) · [Server](./server.md) · [Durable Objects](./durable-objects.md) · [Client](./client.md) · [Reference](./reference.md)
