# Getting started

This page assumes you are new to socka. You do **not** need to know how socka maps to each runtime yet—first pick **where your WebSocket server will run**, skim the right guide, then come back here and follow the same shape everywhere: **install → shared contract → server handlers → client `SockaSession`**.

## What socka is

**socka** is **schema-first WebSocket RPC**: one **`defineSocka`** contract gives you typed **`session.send.*`** calls in the browser and **`handlers`** on the server, with socka **v1** frames on the wire (no hand-rolled message unions). You still choose **how** the socket is created—Bun, Hono, Node **`ws`**, Cloudflare **Durable Objects**, etc.—socka provides the adapters for each.

If you want the full picture of frames and options later, see **[Reference](./reference.md)**.

## Step 1 — Choose your WebSocket stack

Pick the row that matches **your** deployment. Open the linked doc only for that path; you can ignore the others until you need them.

| You want to… | Read this first | socka pieces |
|--------------|-----------------|--------------|
| Use **Node** with the **`ws`** package, or any runtime that gives you a standard **`WebSocket`** after an upgrade | **[Server](./server.md)** — **`attachSockaWebSocket`**, **`@firtoz/socka/server`** | `@firtoz/socka/server` |
| Use **Bun** **`Bun.serve`** with **`ServerWebSocket`** | **[Server](./server.md)** — **`@firtoz/socka/bun`** | `@firtoz/socka/bun` |
| Use **Hono** on **Node** with **`@hono/node-ws`** | **[Server](./server.md)** — **`@firtoz/socka/hono`** | `@firtoz/socka/hono` |
| Use **Hono** on **Cloudflare Workers** (WebSocket upgrade) | **[Server](./server.md)** — **`@firtoz/socka/hono/cloudflare`** | `@firtoz/socka/hono/cloudflare` |
| Use **Cloudflare Durable Objects** (one isolate per “room”, hibernation, **`SockaWebSocketDO`**) | **[Durable Objects](./durable-objects.md)** | `@firtoz/socka/do` |

**Multiple rooms or scopes?** After the basics, see **[Multi-room](./multi-room.md)**.

**What to install besides `socka`?** Depends on which **`import`** you use—see **[Peers](./peers.md)** so you add the right optional peers once.

When you know which row you are in, continue below—you will point your app at the matching server guide after the contract exists.

## Step 2 — Install socka

```bash
bun add @firtoz/socka
```

Add any **peer dependencies** for the paths you import (React, `@firtoz/socka/do`, Hono, …)—**[Peers](./peers.md)** has the full table.

## Step 3 — Define a contract

One module, shared by client and server:

```ts
import { defineSocka } from "@firtoz/socka/core";
import * as z from "zod";

const messageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  body: z.string(),
});

export const myContract = defineSocka({
  calls: {
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

Calls **with** an `input` schema use **`(input, session) => output`**. Calls with **only** `output` use **`(session) => output`**—there is no `undefined` first argument. Optional inputs belong in the schema (e.g. `.optional()`), not in the function arity.

## Step 4 — Server and client

1. **Server** — Follow the guide you chose in **Step 1**: **[Server](./server.md)** for **`SockaWebSocketSession`** / **`attachSockaWebSocket`**, Bun, or Hono; **[Durable Objects](./durable-objects.md)** for **`SockaDoSession`** / **`SockaWebSocketDO`**. Implement **`handlers`** and **`handleClose(session)`** with your shared contract.
2. **Client** — Use **`SockaSession`**, **`useSockaSession`**, or **`SockaSessionProvider`** with the **same** contract and **`wireFormat`** as the server—**[Client](./client.md)**.

### Wire format (short)

Default is **JSON text** frames. **`wireFormat: "msgpack"`** must be set on **both** client and server if you use binary frames. Details: **[Reference — Wire encoding](./reference.md#wire-encoding-json-and-msgpack)**.

## Step 5 — Run something you can play with

The fastest way to see socka end-to-end is a **full-stack demo** in this repo: the same **tic-tac-toe** game and contract, three different servers.

1. Open the folder for the stack you care about (from **Step 1**):

   | Stack | Folder | Dev port |
   |-------|--------|----------|
   | **Bun** | [`tic-tac-toe-bun`](../../../examples/tic-tac-toe-bun) | **3461** |
   | **Hono + Node** | [`tic-tac-toe-hono`](../../../examples/tic-tac-toe-hono) | **3462** |
   | **Durable Objects** | [`tic-tac-toe-do`](../../../examples/tic-tac-toe-do) | **3463** |

2. From that folder, run **`bun run dev`**. The Cloudflare Workers + Durable Objects example runs **`wrangler dev`** (and builds the browser client) inside that script; the Bun and Hono examples start their dev servers directly.

3. Open the printed local URL in a browser and use the UI—you are exercising **`defineSocka`**, server **handlers**, and the **client** over a real WebSocket.

Ports are chosen so the three examples can run on one machine without colliding. If you are not on Cloudflare Workers, start with **Bun** or **Hono**; the third demo targets **`SockaWebSocketDO`** and **`wrangler dev`**.

---

Next: [Peers](./peers.md) · [Server](./server.md) · [Durable Objects](./durable-objects.md) · [Client](./client.md) · [Reference](./reference.md)
