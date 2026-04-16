# Getting started

**Socka** is **schema-first WebSocket RPC** for TypeScript: one **`defineSocka`** contract gives you **`session.send.*`** on the client and **`handlers`** on the server, with validation and correlated request/response on the wire.

The **[README](../README.md)** has a runnable **Bun** example if you want to copy three files and go. This page helps you **pick a runtime** and wire the same contract everywhere.

For API tables (options, hooks), see **[Reference](./reference.md)**. For how the wire protocol is structured (optional), see **[Internals](./internals.md)**.

---

## Shared contract

Use one module on the client and server:

**`contract.ts`**

```ts
import { defineSocka } from "@firtoz/socka/core";
import * as z from "zod";

export const myContract = defineSocka({
	calls: {
		echo: {
			input: z.object({ message: z.string() }),
			output: z.object({ response: z.string() }),
		},
	},
});
```

---

## Shared client

Point the URL at whatever path your server upgrades (here **`/ws`** — only a convention; match your server):

**`client.ts`**

```ts
import { SockaSession } from "@firtoz/socka/client";
import { myContract } from "./contract";

const session = new SockaSession({
	contract: myContract,
	url: "ws://localhost:3450/ws",
});
const { response } = await session.send.echo({ message: "hello" });
```

By default, socka uses **JSON text** WebSocket frames. If you switch to **`msgpack`**, set **`wireFormat`** the same on client and server — see **[Reference](./reference.md)**.

---

## Choose your server runtime

| Runtime | Install | Where to wire socka |
|---------|---------|---------------------|
| **Bun** (`Bun.serve`) | `npm install @firtoz/socka` — add **`bun-types`** dev if you type-check Bun APIs | **[Bun](#bun-bunserve)** below · **[Server](./server.md#firtoz-socka-bun-bunserve)** |
| **Node + `ws`** | `npm install @firtoz/socka ws` — add **`@types/ws`** dev when you use **`ws`** on Node | **[Node](#node--ws)** · **[Server](./server.md)** |
| **Hono on Node** (`@hono/node-ws`) | `npm install @firtoz/socka hono @hono/node-ws @hono/node-server ws` | **[Hono (Node)](#hono-on-node)** · **[Server](./server.md#firtoz-socka-hono-node-hono-node-ws)** |
| **Hono on Cloudflare Workers** | `npm install @firtoz/socka hono` | **[Hono (Workers)](#hono-on-cloudflare-workers)** · **[Server](./server.md#firtoz-socka-hono-cloudflare-workers)** |
| **Cloudflare Durable Objects** | `npm install @firtoz/socka hono @firtoz/websocket-do` | **[Durable Objects](./durable-objects.md)** · **[DO overview](#cloudflare-durable-objects)** |

More install notes and peers: **[Peers](./peers.md)**. Cloudflare TypeScript: prefer **`wrangler types`** — [Cloudflare docs](https://developers.cloudflare.com/workers/languages/typescript).

**Multiple rooms or scopes?** See **[Multi-room](./multi-room.md)**.

---

### Bun (`Bun.serve`)

**`server.ts`**

```ts
import { createSockaBunWebSocketHandlers } from "@firtoz/socka/bun";
import { myContract } from "./contract";

const { websocket } = createSockaBunWebSocketHandlers({
	contract: myContract,
	handlers: {
		echo: async (input) => ({ response: input.message }),
	},
	handleClose: async () => {},
});

Bun.serve({
	port: 3450,
	fetch(req, server) {
		// "/ws" is just a convention — any path works; you decide when to call upgrade()
		if (new URL(req.url).pathname === "/ws") {
			if (server.upgrade(req)) return undefined;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}
		return new Response("OK");
	},
	websocket,
});
```

Run **`bun run server.ts`**, then run the client against **`ws://localhost:3450/ws`**.

**Full-stack demo:** [`tic-tac-toe-bun`](../../../examples/tic-tac-toe-bun) (port **3461**, **`bun run dev`**).

---

### Node + `ws`

**`server.ts`**

```ts
import { WebSocketServer } from "ws";
import { attachSockaWebSocket } from "@firtoz/socka/server";
import type { SockaWebSocketSession } from "@firtoz/socka/server";
import { myContract } from "./contract";

const sessions = new Map<
	WebSocket,
	SockaWebSocketSession<typeof myContract>
>();

const wss = new WebSocketServer({ port: 3450 });
wss.on("connection", (ws) => {
	attachSockaWebSocket(
		ws as unknown as WebSocket,
		sessions,
		{
			contract: myContract,
			handlers: {
				echo: async (input) => ({ response: input.message }),
			},
			handleClose: async () => {},
		},
	);
});
```

The `ws` package’s socket type may differ from the DOM **`WebSocket`** type; the cast above is a common pattern. Use the same **`ws://…/ws`** URL in the client if you listen on **`3450`**.

**Full-stack demo:** [`tic-tac-toe-hono`](../../../examples/tic-tac-toe-hono) (Hono on Node — port **3462**, **`bun run dev`**). For plain **`ws`** integration tests, see [`tests/socka-server-test`](https://github.com/firtoz/fullstack-toolkit/tree/main/tests/socka-server-test).

---

### Hono on Node

**`server.ts`**

```ts
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { sockaHonoNodeWs } from "@firtoz/socka/hono";
import { myContract } from "./contract";

const app = new Hono();
const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

app.get(
	"/ws",
	upgradeWebSocket(
		sockaHonoNodeWs({
			contract: myContract,
			handlers: {
				echo: async (input) => ({ response: input.message }),
			},
			handleClose: async () => {},
		}),
	),
);

const server = serve({ fetch: app.fetch, port: 3450 });
injectWebSocket(server);
```

**Full-stack demo:** [`tic-tac-toe-hono`](../../../examples/tic-tac-toe-hono).

---

### Hono on Cloudflare Workers

**`src/index.ts`** (shape only — you still need Wrangler bindings and `export default` wiring for your Worker)

```ts
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/cloudflare-workers";
import { sockaHonoCloudflare } from "@firtoz/socka/hono/cloudflare";
import { myContract } from "./contract";

const app = new Hono();

app.get(
	"/ws",
	upgradeWebSocket(
		sockaHonoCloudflare({
			contract: myContract,
			handlers: {
				echo: async (input) => ({ response: input.message }),
			},
			handleClose: async () => {},
		}),
	),
);
```

On Workers, the socka session is often created on the **first message** (see **[Server](./server.md#firtoz-socka-hono-cloudflare-workers)**).

**Examples:** full tic-tac-toe apps — **[Bun](../../../examples/tic-tac-toe-bun)** · **[Hono + Node](../../../examples/tic-tac-toe-hono)** · **[Cloudflare (Hono + DO)](../../../examples/tic-tac-toe-do)**. The DO app is the fleshed-out **Workers** sample; it uses **`SockaWebSocketDO`**, not a standalone **`sockaHonoCloudflare`** Worker. For Workers + Hono upgrade **without** a DO, follow **[Server](./server.md)**.

---

### Cloudflare Durable Objects

Socka on a DO uses **`SockaDoSession`** and usually **`SockaWebSocketDO`** from **`@firtoz/socka/do`**. The contract is the same; wiring goes through your Durable Object class and **`@firtoz/websocket-do`**.

See **[Durable Objects](./durable-objects.md)** for **`SockaWebSocketDO`**, hibernation, and Wrangler setup.

**Full-stack demo:** [`tic-tac-toe-do`](../../../examples/tic-tac-toe-do) (port **3463**, **`wrangler dev`**).

---

## Full-stack demos (tic-tac-toe)

Same game logic, different servers:

| Stack | Folder | Port |
|-------|--------|------|
| **Bun** | [`tic-tac-toe-bun`](../../../examples/tic-tac-toe-bun) | **3461** |
| **Hono + Node** | [`tic-tac-toe-hono`](../../../examples/tic-tac-toe-hono) | **3462** |
| **Durable Objects** | [`tic-tac-toe-do`](../../../examples/tic-tac-toe-do) | **3463** |

From each folder: **`bun run dev`**, except the DO app: **`wrangler dev`**.

---

Next: [Peers](./peers.md) · [Server](./server.md) · [Durable Objects](./durable-objects.md) · [Client](./client.md) · [Reference](./reference.md) · [Internals](./internals.md)
