# @firtoz/socka

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fsocka.svg)](https://www.npmjs.com/package/@firtoz/socka)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fsocka.svg)](https://www.npmjs.com/package/@firtoz/socka)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fsocka.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-RPC-6366f1)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![Standard Schema](https://img.shields.io/badge/Standard_Schema-v1-1e293b)](https://standardschema.dev)

![Socka — WebSocket RPC, Standard Schema](./assets/banner.png)

**Typed WebSocket RPC for TypeScript.** Define one contract, get **`session.send.*`** in the client and **`handlers`** on the server—validated, correlated, done.

**npm:** [`@firtoz/socka`](https://www.npmjs.com/package/@firtoz/socka). *Socka* is the project name in prose; **install and `import` paths always use `@firtoz/socka` or `@firtoz/socka/...`**. The published artifact is **compiled ESM + `.d.ts` in `dist/`** (see `package.json` `exports`).

## 30-second example (Bun)

**`contract.ts`** (shared):

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

**`server.ts`**:

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

**`client.ts`** (browser or Bun):

```ts
import { SockaSession } from "@firtoz/socka/client";
import { myContract } from "./contract";

const session = new SockaSession({
	contract: myContract,
	url: "ws://localhost:3450/ws",
});
const { response } = await session.send.echo({ message: "hello" });
console.log(response);
```

Run **`bun run server.ts`**, then point the client at **`ws://localhost:3450/ws`** (same path you upgraded in `fetch`).

For fuller apps, see the tic-tac-toe examples: **[Bun](../../examples/tic-tac-toe-bun)** · **[Hono + Node](../../examples/tic-tac-toe-hono)** · **[Cloudflare DO](../../examples/tic-tac-toe-do)**.

## Install

Always install **`@firtoz/socka`**, then add **only** what your imports need (`npm` / `pnpm` / `bun add` as you prefer):

| You are building… | Install |
|-------------------|---------|
| **Browser / Vite SPA** (client only) | `npm install @firtoz/socka` |
| **React** (`@firtoz/socka/react`) | `npm install @firtoz/socka react` — add **`@types/react`** as a dev dependency if TypeScript asks |
| **Bun** (`Bun.serve`, `@firtoz/socka/bun`) | `npm install @firtoz/socka` — add **`bun-types`** as a dev dependency if you type-check Bun APIs |
| **Node + Hono + `@hono/node-ws`** | `npm install @firtoz/socka hono @hono/node-ws @hono/node-server ws` — add **`@types/ws`** as a dev dependency when you use **`ws`** on Node |
| **Cloudflare Workers + Hono** (`@firtoz/socka/hono/cloudflare`) | `npm install @firtoz/socka hono` |
| **Cloudflare Durable Objects** (`@firtoz/socka/do`) | `npm install @firtoz/socka hono @firtoz/websocket-do` |

For **Cloudflare TypeScript types**, prefer **`wrangler types`** (or your app’s typegen) so globals and bindings match your Worker — see [Cloudflare’s TypeScript guide](https://developers.cloudflare.com/workers/languages/typescript). More detail: **[Peers](./docs/peers.md)**.

## Other runtimes

Pick how the socket is upgraded, then use the matching import path and guide:

| Runtime | Import path | Quick start |
|---------|-------------|-------------|
| **Node + [`ws`](https://github.com/websockets/ws)** (or any standard **`WebSocket`** after upgrade) | `@firtoz/socka/server` | [`attachSockaWebSocket`](./docs/server.md) |
| **Bun** (`Bun.serve` / `ServerWebSocket`) | `@firtoz/socka/bun` | [`createSockaBunWebSocketHandlers`](./docs/server.md#firtoz-socka-bun-bunserve) |
| **Hono on Node** (`@hono/node-ws`) | `@firtoz/socka/hono` | [`sockaHonoNodeWs`](./docs/server.md#firtoz-socka-hono-node-hono-node-ws) |
| **Hono on Cloudflare Workers** | `@firtoz/socka/hono/cloudflare` | [`sockaHonoCloudflare`](./docs/server.md#firtoz-socka-hono-cloudflare-workers) |
| **Cloudflare Durable Objects** | `@firtoz/socka/do` | **[Durable Objects](./docs/durable-objects.md)** |

## Why not socket.io, tRPC, or DIY?

- **Schema-first RPC + push** — one contract; no parallel “event” protocol for server pushes.
- **Correlated envelopes** — request/response IDs and validation hooks are built in.
- **Same contract** across Bun, Hono, Node `ws`, and Durable Objects (see **[Comparison](./docs/comparison.md)** for socket.io / tRPC / hand-rolled).

## Documentation

Hub: **[`docs/README.md`](./docs/README.md)** (getting started, peers, lifecycle, multi-room, reference).

**Roadmap:** [post–v1 and deferred work](./roadmap.md). Agent skills: [`skills/`](./skills/).

## Full-stack examples

Self-contained **tic-tac-toe** apps in the monorepo [`examples/`](../../examples/) (same game, different servers):

| Stack | Folder | Port |
|--------|--------|------|
| **Bun** (`@firtoz/socka/bun`) | [`tic-tac-toe-bun`](../../examples/tic-tac-toe-bun) | **3461** |
| **Hono + Node** (`@firtoz/socka/hono`) | [`tic-tac-toe-hono`](../../examples/tic-tac-toe-hono) | **3462** |
| **Cloudflare DO** (`@firtoz/socka/do`) | [`tic-tac-toe-do`](../../examples/tic-tac-toe-do) | **3463** |

Each app: **`bun run dev`** (or **`wrangler dev`** for the DO example).
