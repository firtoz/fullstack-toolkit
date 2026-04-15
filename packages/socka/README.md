# @firtoz/socka

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fsocka.svg)](https://www.npmjs.com/package/@firtoz/socka)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fsocka.svg)](https://www.npmjs.com/package/@firtoz/socka)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fsocka.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-RPC-6366f1)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![Standard Schema](https://img.shields.io/badge/Standard_Schema-v1-1e293b)](https://standardschema.dev)

![Socka — WebSocket RPC, Standard Schema](./assets/banner.png)

**Typed WebSocket RPC.** One `defineSocka` contract, inferred `session.send.*`, correlated request/response frames, and optional typed **pushes**—without hand-rolled message unions or duplicate schema layers.

## The problem

Most hand-rolled WebSocket protocols duplicate schemas, juggle correlation IDs by hand, and treat server push as a second, parallel protocol. **socka** replaces that with a **single shared contract** (Standard Schema v1) that drives both ends.

## Minimal example

**Contract** (shared):

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

**Client:**

```ts
import { SockaSession } from "@firtoz/socka/client";
import { myContract } from "./contract";

const session = new SockaSession({ contract: myContract, url: "wss://example.com/ws" });
const { text } = await session.send.echo({ text: "hello" });
```

Wire the **server** for your runtime in the table below (one stack per connection).

## Install

```bash
npm install @firtoz/socka
```

Also: `pnpm add @firtoz/socka` · `bun add @firtoz/socka`

Optional peers depend on which subpath you import—see **[Peers](./docs/peers.md)**.

## Server (pick your runtime)

| Runtime | Guide |
|--------|--------|
| **Node** + [`ws`](https://github.com/websockets/ws), or any standard **`WebSocket`** | **[Server](./docs/server.md)** — `attachSockaWebSocket`, `@firtoz/socka/server` |
| **Bun** `Bun.serve` / `ServerWebSocket` | **[Server](./docs/server.md)** — `@firtoz/socka/bun` |
| **Hono** on Node (`@hono/node-ws`) | **[Server](./docs/server.md)** — `@firtoz/socka/hono` |
| **Hono** on Cloudflare Workers | **[Server](./docs/server.md)** — `@firtoz/socka/hono/cloudflare` |
| **Cloudflare Durable Objects** | **[Durable Objects](./docs/durable-objects.md)** — `@firtoz/socka/do`, `SockaWebSocketDO` |

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
