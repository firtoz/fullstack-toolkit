# @firtoz/socka

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fsocka.svg)](https://www.npmjs.com/package/@firtoz/socka)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fsocka.svg)](https://www.npmjs.com/package/@firtoz/socka)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fsocka.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-RPC-6366f1)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![Standard Schema](https://img.shields.io/badge/Standard_Schema-v1-1e293b)](https://standardschema.dev)

![Socka — WebSocket RPC, Standard Schema](./assets/banner.png)

**Typed WebSocket RPC and pushes for TypeScript.** One **`defineSocka`** contract gives you **`session.send.*`** for RPCs and **`session.subscribe`** for **typed server pushes**—validated, correlated, same schema on client and server.

**Validation is [Standard Schema](https://standardschema.dev) v1**, not Zod-specific: any compliant library works (e.g. **Zod**, **Valibot**, or others). Examples below use **Zod** for familiarity.

**npm:** [`@firtoz/socka`](https://www.npmjs.com/package/@firtoz/socka). *Socka* is the project name in prose; **install and `import` paths always use `@firtoz/socka` or `@firtoz/socka/...`**. The published artifact is **compiled ESM + `.d.ts` in `dist/`** (see `package.json` `exports`).

## Minimal example: multi-room chat (Bun)

Join/leave and live messages use **`pushes`**; persisted lines use **`listHistory`**; who is connected uses **`listPresence`**; **`clearHistory`** wipes stored messages and **`historyCleared`** notifies the room (examples also show presence in the UI). This snippet keeps **history in memory** so it stays short—see **[chatroom-bun](../../examples/chatroom-bun)** for **SQLite**, **[chatroom-hono](../../examples/chatroom-hono)** for **file JSON**, and **[chatroom-do](../../examples/chatroom-do)** for **Durable Object SQLite**.

**`contract.ts`** (shared):

```ts
import { defineSocka } from "@firtoz/socka/core";
import * as z from "zod";

export const messageRow = z.object({
	id: z.string(),
	ts: z.number(),
	userId: z.string(),
	displayName: z.string(),
	text: z.string(),
});

export type ChatMessageRow = z.infer<typeof messageRow>;

const onlineUser = z.object({
	userId: z.string(),
	displayName: z.string(),
});

export const chatContract = defineSocka({
	calls: {
		listHistory: {
			input: z.object({ limit: z.number().int().min(1).max(500).optional() }),
			output: z.object({ messages: z.array(messageRow) }),
		},
		listPresence: {
			input: z.object({}).optional(),
			output: z.object({
				selfUserId: z.string(),
				users: z.array(onlineUser),
			}),
		},
		sendMessage: {
			input: z.object({ text: z.string().min(1) }),
			output: z.object({ ok: z.literal(true) }),
		},
		clearHistory: {
			input: z.object({}).optional(),
			output: z.object({ ok: z.literal(true) }),
		},
	},
	pushes: {
		userJoined: z.object({ userId: z.string(), displayName: z.string() }),
		userLeft: z.object({
			userId: z.string(),
			displayName: z.string(),
		}),
		roomMessage: messageRow,
		historyCleared: z.object({
			ts: z.number(),
			clearedByUserId: z.string(),
			clearedByDisplayName: z.string(),
		}),
	},
});
```

**`server.ts`** — **`createSockaRoomRegistry`** gives each room its own **`sessionMap`** and **config**. By default **`createData`** receives **`SockaStrictWebSocketInit`**: **`init.request`** is the upgrade **`Request`** (Bun/Hono/adapters pass it through; see **[Server — Strict upgrade request](./docs/server.md#strict-upgrade-request)**). Set **`strictUpgradeRequest: false`** when you have no **`Request`**. **`session.listPeers()`** returns **`session.data`** for other sockets in the same room—use it to implement **`listPresence`**-style calls (see **[Presence](./docs/presence.md)**).

```ts
import type { ServerWebSocket } from "bun";
import { createSockaBunWebSocketHandlers } from "@firtoz/socka/bun";
import {
	createSockaRoomRegistry,
	type SockaWebSocketSessionConfig,
} from "@firtoz/socka/server";
import { type ChatMessageRow, chatContract } from "./contract";

type SessionData = { roomId: string; userId: string; displayName: string };

/** In-memory demo store — swap for SQLite / files / DO in real apps. */
const history = new Map<string, ChatMessageRow[]>();

const registry = createSockaRoomRegistry(
	(roomId): SockaWebSocketSessionConfig<typeof chatContract, SessionData> => ({
		contract: chatContract,
		createData: (init) => {
			const u = new URL(init.request.url);
			const displayName = u.searchParams.get("name")?.trim() || "anon";
			return { roomId, userId: crypto.randomUUID(), displayName };
		},
		onAttached: async (session) => {
			await session.broadcastPush(
				"userJoined",
				{ userId: session.data.userId, displayName: session.data.displayName },
				true,
			);
		},
		handlers: {
			listHistory: async (input, session) => {
				const lim = input.limit ?? 200;
				const rows = history.get(session.data.roomId) ?? [];
				return { messages: rows.slice(-lim) };
			},
			listPresence: async (_input, session) => {
				const users = session.listPeers().map((d) => ({
					userId: d.userId,
					displayName: d.displayName,
				}));
				users.sort((a, b) => a.displayName.localeCompare(b.displayName));
				return { selfUserId: session.data.userId, users };
			},
			sendMessage: async (input, session) => {
				const row = {
					id: crypto.randomUUID(),
					ts: Date.now(),
					userId: session.data.userId,
					displayName: session.data.displayName,
					text: input.text,
				};
				const list = history.get(session.data.roomId) ?? [];
				list.push(row);
				history.set(session.data.roomId, list);
				await session.broadcastPush("roomMessage", row);
				return { ok: true as const };
			},
			clearHistory: async (_input, session) => {
				history.set(session.data.roomId, []);
				const ts = Date.now();
				await session.broadcastPush("historyCleared", {
					ts,
					clearedByUserId: session.data.userId,
					clearedByDisplayName: session.data.displayName,
				});
				return { ok: true as const };
			},
		},
		handleClose: async (session) => {
			await session.broadcastPush(
				"userLeft",
				{ userId: session.data.userId, displayName: session.data.displayName },
				true,
			);
		},
	}),
);

type BunWsData = { roomId: string; request: Request };

const { websocket } = createSockaBunWebSocketHandlers({
	resolveScope(ws: ServerWebSocket<BunWsData>) {
		const { roomId } = ws.data;
		const room = registry.get(roomId);
		return { sessionMap: room.sessionMap, config: room.config };
	},
});

Bun.serve<BunWsData>({
	port: 3450,
	fetch(req, server) {
		const url = new URL(req.url);
		if (url.pathname.startsWith("/ws/")) {
			const roomId = decodeURIComponent(url.pathname.slice(4)) || "default";
			if (server.upgrade(req, { data: { roomId, request: req } })) return undefined;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}
		return new Response("OK");
	},
	websocket,
});
```

*Ports: this minimal snippet listens on **3450**; the [full-stack examples](#full-stack-examples) use **3461–3466**.*

**`client.ts`** (browser or Bun):

```ts
import { SockaSession } from "@firtoz/socka/client";
import { chatContract } from "./contract";

const session = new SockaSession({
	contract: chatContract,
	url: "ws://localhost:3450/ws/lobby?name=Ada",
});

session.subscribe.on("userJoined", (p) => console.log("joined", p));
session.subscribe.on("userLeft", (p) => console.log("left", p.displayName));
session.subscribe.on("roomMessage", (m) => console.log(`${m.displayName}: ${m.text}`));
session.subscribe.on("historyCleared", (p) =>
	console.log("history cleared by", p.clearedByDisplayName, "at", p.ts),
);

const { messages } = await session.send.listHistory({});
console.log("history", messages);
const { selfUserId, users } = await session.send.listPresence({});
console.log("online", selfUserId, users);
await session.send.sendMessage({ text: "hello room" });
await session.send.clearHistory({});
```

Run **`bun run server.ts`**, then point the client at the same **`ws://…/ws/<room>?name=…`** path you upgrade in **`fetch`**.

**More examples:** **[chatroom-bun](../../examples/chatroom-bun)** (SQLite + multi-room UI) · **[chatroom-hono](../../examples/chatroom-hono)** · **[chatroom-do](../../examples/chatroom-do)** · tic-tac-toe **[Bun](../../examples/tic-tac-toe-bun)** · **[Hono + Node](../../examples/tic-tac-toe-hono)** · **[Cloudflare DO](../../examples/tic-tac-toe-do)**.

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
- **Same contract** across Bun, Hono, Node `ws`, and Durable Objects (see **[Comparison](./docs/comparison.md)** for socket.io, tRPC, and custom WebSocket stacks).
- **Room registry + presence helpers** — **`createSockaRoomRegistry`** for per-room **`sessionMap`** / config; **`session.listPeers()`** to list other peers in the room (see **[Presence](./docs/presence.md)**).
- **Strict upgrade typing + optional reconnect** — by default **`createData`** sees **`init.request`** on the upgrade; **`SockaWebSocketClient`** / **`SockaSession`** can **`reconnect`** with exponential backoff (see **[Reconnection](./docs/reconnection.md)**).

## Documentation

Hub: **[`docs/README.md`](./docs/README.md)** (getting started, peers, lifecycle, multi-room, reference).

**Roadmap:** [deferred ideas and future work](./roadmap.md). Agent skills: [`skills/`](./skills/).

## Full-stack examples

| Topic | Stack | Folder | Port |
|-------|--------|--------|------|
| **Chat + history** | **Bun** + SQLite | [`chatroom-bun`](../../examples/chatroom-bun) | **3464** |
| **Chat + history** | **Hono + Node** + JSON files | [`chatroom-hono`](../../examples/chatroom-hono) | **3465** |
| **Chat + history** | **Cloudflare DO** + Drizzle SQLite | [`chatroom-do`](../../examples/chatroom-do) | **3466** |
| Tic-tac-toe | **Bun** | [`tic-tac-toe-bun`](../../examples/tic-tac-toe-bun) | **3461** |
| Tic-tac-toe | **Hono + Node** | [`tic-tac-toe-hono`](../../examples/tic-tac-toe-hono) | **3462** |
| Tic-tac-toe | **Cloudflare DO** | [`tic-tac-toe-do`](../../examples/tic-tac-toe-do) | **3463** |

Chat apps: **`bun run dev`** (or **`wrangler dev`** for **`chatroom-do`**). Tic-tac-toe: same.
