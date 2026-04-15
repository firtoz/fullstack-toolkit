# Getting started

The **[README](../README.md)** opens with a **complete Bun example**: shared contract, **`createSockaBunWebSocketHandlers`**, and **`SockaSession`**. Start there if you want something runnable in one minute.

## Quickest path (Bun)

Save three files next to each other, then run **`bun run server.ts`**. Point a client at **`ws://localhost:3450/ws`** (same contract as the README).

**`contract.ts`**

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

**`server.ts`**

```ts
import { createSockaBunWebSocketHandlers } from "@firtoz/socka/bun";
import { myContract } from "./contract";

const { websocket } = createSockaBunWebSocketHandlers({
	contract: myContract,
	handlers: {
		echo: async (input) => ({ text: input.text }),
	},
	handleClose: async () => {},
});

Bun.serve({
	port: 3450,
	fetch(req, server) {
		if (new URL(req.url).pathname === "/ws") {
			if (server.upgrade(req)) return undefined;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}
		return new Response("OK");
	},
	websocket,
});
```

**`client.ts`**

```ts
import { SockaSession } from "@firtoz/socka/client";
import { myContract } from "./contract";

const session = new SockaSession({
	contract: myContract,
	url: "ws://localhost:3450/ws",
});
const { text } = await session.send.echo({ text: "hello" });
```

## What socka is

**Socka** is the library; the **npm package name is [`@firtoz/socka`](https://www.npmjs.com/package/@firtoz/socka)** (scoped). It is **schema-first WebSocket RPC**: one **`defineSocka`** contract gives you typed **`session.send.*`** in the browser and **`handlers`** on the server, with Socka **v1** frames on the wire.

For frame shapes and options, see **[Reference](./reference.md)**.

## Other runtimes

Pick **how** the socket is upgraded, then use the matching subpath:

| You want to… | Read this first | Import path |
|--------------|-----------------|-------------|
| **Node** + **`ws`**, or any standard **`WebSocket`** after upgrade | **[Server](./server.md)** — **`attachSockaWebSocket`** | `@firtoz/socka/server` |
| **Bun** **`Bun.serve`** / **`ServerWebSocket`** | **[Server](./server.md)** — **`@firtoz/socka/bun`** | `@firtoz/socka/bun` |
| **Hono** on **Node** (`@hono/node-ws`) | **[Server](./server.md)** — **`sockaHonoNodeWs`** | `@firtoz/socka/hono` |
| **Hono** on **Cloudflare Workers** | **[Server](./server.md)** — **`sockaHonoCloudflare`** | `@firtoz/socka/hono/cloudflare` |
| **Cloudflare Durable Objects** | **[Durable Objects](./durable-objects.md)** | `@firtoz/socka/do` |

**Multiple rooms or scopes?** See **[Multi-room](./multi-room.md)**.

## Install

```bash
npm install @firtoz/socka
```

Add **only** the peers for the subpaths you import—**[Peers](./peers.md)**.

## Shared contract

Use one module for client and server (same as the README):

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

## Wire the server, then the client

You already have the **client** shape (`SockaSession` with the same contract). Now:

1. **Server** — Open the guide from **Other runtimes** and implement **`handlers`** + **`handleClose`** for **`myContract`**. Use **`SockaWebSocketSession`** / **`attachSockaWebSocket`** (Node/Bun/Hono) or **`SockaDoSession`** / **`SockaWebSocketDO`** (Durable Objects).
2. **Client** — Keep **`SockaSession`** (or **`useSockaSession`** / **`SockaSessionProvider`**—**[Client](./client.md)**) with the **same** **`wireFormat`** as the server.

### Wire format (short)

Default is **JSON text** frames. **`wireFormat: "msgpack"`** must match on **both** sides. Details: **[Reference — Wire encoding](./reference.md#wire-encoding-json-and-msgpack)**.

## Run a full-stack demo

Same **tic-tac-toe** contract and game logic, three servers in this repo:

| Stack | Folder | Port |
|-------|--------|------|
| **Bun** | [`tic-tac-toe-bun`](../../../examples/tic-tac-toe-bun) | **3461** |
| **Hono + Node** | [`tic-tac-toe-hono`](../../../examples/tic-tac-toe-hono) | **3462** |
| **Durable Objects** | [`tic-tac-toe-do`](../../../examples/tic-tac-toe-do) | **3463** |

From the folder: **`bun run dev`**. The DO example uses **`wrangler dev`**.

---

Next: [Peers](./peers.md) · [Server](./server.md) · [Durable Objects](./durable-objects.md) · [Client](./client.md) · [Reference](./reference.md)
