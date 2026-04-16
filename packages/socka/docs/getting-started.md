# Getting started

This guide walks through a **multi-room chat** on one **`defineSocka`** contract: **typed RPCs** (`listHistory`, `listPresence`, `sendMessage`, `clearHistory`) and **typed pushes** (`userJoined`, `userLeft`, `roomMessage`, `historyCleared`). The **[README](../README.md)** has the shortest runnable **Bun** slice (in-memory history).

**Runnable apps** with persistence and a **multi-room browser client**: **[chatroom-bun](../../../examples/chatroom-bun)** (Bun SQLite), **[chatroom-hono](../../../examples/chatroom-hono)** (JSON files), **[chatroom-do](../../../examples/chatroom-do)** (Durable Object SQLite + Drizzle).

For API tables, see **[Reference](./reference.md)**. For wire details, **[Internals](./internals.md)**.

---

## Step 1 — What you are building

1. Clients connect to **`ws://host/ws/<roomId>?name=<displayName>`** (path and query are conventions you control).
2. Each **room** has its own **`sessionMap`** and **config** — see **[Multi-room](./multi-room.md)**.
3. **Join/leave** are **`pushes`** to everyone else in the room; **chat lines** are **`pushes`** too (after you persist).
4. **History** is loaded with a **call** (`listHistory`) so reconnects and new panes can hydrate from storage (SQLite, JSON files, or DO SQLite in the examples).

---

## Step 2 — Shared contract

Use one module on the client and every server:

**`contract.ts`**

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

---

## Step 3 — Client: subscribe, hydrate, send

1. Open **`SockaSession`** with **`url`** pointing at your upgrade path (same **`roomId`** and **`name`** the server parses in **`createData`**).
2. After the socket is ready, **`await session.send.listHistory({})`** (or `{ limit: 100 }`) and render **`messages`**, then **`await session.send.listPresence({})`** to show **who is online** (compare **`selfUserId`** to highlight the current user).
3. Register **`session.subscribe.on("userJoined" | "userLeft" | "roomMessage" | "historyCleared", …)`** for live updates (merge joins/leaves into your presence UI; on **`historyCleared`**, drop or redraw stored chat lines for that room).
4. Send **`await session.send.sendMessage({ text: "…" })`**. Optional: **`await session.send.clearHistory({})`** to wipe persisted messages for the room (server should **`broadcastPush("historyCleared", …)`** so every client updates).

**Minimal client**

```ts
import { SockaSession } from "@firtoz/socka/client";
import { chatContract } from "./contract";

const session = new SockaSession({
	contract: chatContract,
	url: "ws://localhost:3464/ws/lobby?name=Ada",
});

session.subscribe.on("userJoined", (p) => console.log("in", p.displayName));
session.subscribe.on("userLeft", (p) => console.log("out", p.displayName));
session.subscribe.on("roomMessage", (m) => console.log(`${m.displayName}: ${m.text}`));
session.subscribe.on("historyCleared", (p) =>
	console.log("cleared by", p.clearedByDisplayName),
);

const { messages } = await session.send.listHistory({ limit: 50 });
for (const m of messages) console.log(`[hist] ${m.displayName}: ${m.text}`);

const { selfUserId, users } = await session.send.listPresence({});
console.log("online", selfUserId, users);

await session.send.sendMessage({ text: "hello" });
```

**Multiple rooms on one page** — use **one `SockaSession` per room** (see the chat example **`public/index.html`** + **`src/client.ts`**): each pane builds its own URL and keeps its own subscriptions.

By default, **`wireFormat`** is JSON — see **[Reference](./reference.md#wire-encoding-json-and-msgpack)** if you use **`msgpack`**.

---

## Step 4 — Server behavior (all runtimes)

For each **`SockaWebSocketSessionConfig`** / **`SockaDoSessionConfig`**:

1. **`createData`** — Parse **`roomId`** from the upgrade URL (path) and **`displayName`** from **`name`** query; set **`userId`** (e.g. **`crypto.randomUUID()`**). Same shape as the README **`SockaWebSocketInit`** / Hono **`Context`** on DO.
2. **`onAttached`** — `await session.broadcastPush("userJoined", { userId, displayName }, true)` (**`excludeSelf: true`** so only peers see the join).
3. **`handlers.listHistory`** — Read from your store for **`session.data.roomId`** (Bun: SQLite; Hono: JSON file; DO: SQLite in the object).
4. **`handlers.listPresence`** — Walk the room’s **`sessionMap`** (or DO **`this.sessions`**) and return **`{ selfUserId: session.data.userId, users: [{ userId, displayName }, …] }`** sorted for display.
5. **`handlers.sendMessage`** — Persist the line, then **`await session.broadcastPush("roomMessage", row)`** (everyone in the room, including the sender, unless you choose **`excludeSelf`**).
6. **`handlers.clearHistory`** — Delete persisted messages for **`session.data.roomId`**, then **`await session.broadcastPush("historyCleared", { ts, clearedByUserId, clearedByDisplayName })`** so all clients refresh their UI.
7. **`handleClose`** — `await session.broadcastPush("userLeft", { userId, displayName: session.data.displayName }, true)` — **`displayName`** is the **session’s name at disconnect** (same field as in **`userJoined`** / messages), so clients can render a leave line without guessing from **`userId`** alone. Session is still in **`sessions`** until **`handleClose`** finishes — see **[Lifecycle](./lifecycle.md)**.

---

## Step 5 — Wire the server by runtime

Pick a row, then follow the numbered steps in that subsection.

| Runtime | Install | Full example |
|---------|---------|--------------|
| **Bun** | `npm install @firtoz/socka` (+ **`bun-types`** dev if needed) | [chatroom-bun](../../../examples/chatroom-bun) |
| **Node + `ws`** | `npm install @firtoz/socka ws` (+ **`@types/ws`** dev) | Same contract; attach pattern below |
| **Hono (Node)** | `npm install @firtoz/socka hono @hono/node-ws @hono/node-server ws` | [chatroom-hono](../../../examples/chatroom-hono) |
| **Hono (Workers)** | `npm install @firtoz/socka hono` | **[Server](./server.md#firtoz-socka-hono-cloudflare-workers)** — usually **`sockaHonoCloudflare`**; session often starts on first message |
| **Durable Objects** | `npm install @firtoz/socka hono @firtoz/websocket-do` | [chatroom-do](../../../examples/chatroom-do) |

More installs: **[Peers](./peers.md)**. Cloudflare typings: **`wrangler types`**.

### Bun (`Bun.serve`)

1. **Open** a **`Database`** from **`bun:sqlite`** (one file; table keyed by **`room_id`**), **`CREATE TABLE IF NOT EXISTS`** for messages.
2. **`getOrCreateRoom(roomId)`** returns **`{ sessionMap, config }`** where **`config`** closes over **`roomId`** and **`db`**.
3. **`createSockaBunWebSocketHandlers({ resolveScope })`** — **`resolveScope(ws)`** reads **`ws.data.roomId`** (set in **`fetch`** via **`server.upgrade(req, { data: { roomId } })`**).
4. **`fetch`** upgrades **`/ws/:roomId`** (decode the segment).

### Node + `ws`

1. **`new WebSocketServer({ port })`**.
2. On **`connection`**, parse **`roomId`** from **`req.url`**, **`getOrCreateRoom`**, then **`attachSockaWebSocket( ws, room.sessionMap, room.config, { request: req } )`** so **`createData`** sees the URL.

### Hono on Node

1. **`createNodeWebSocket({ app })`** from **`@hono/node-ws`**.
2. **`app.get("/ws/:roomId", upgradeWebSocket((c) => { const room = getOrCreateRoom(c.req.param("roomId")); return sockaHonoNodeWs(room.config, { sessions: room.sessionMap })(c); }))`**.
3. **`serve`** + **`injectWebSocket(server)`**.

### Hono on Cloudflare Workers

1. Use **`upgradeWebSocket`** from **`hono/cloudflare-workers`** with **`sockaHonoCloudflare`** — see **[Server](./server.md)**.
2. For **room routing** without a DO, put **`roomId`** in the path and parse it in **`createData`** from **`init.request`**.

### Cloudflare Durable Objects

1. **Worker** — route **`/ws/:roomId`** to **`env.CHAT_ROOM.idFromName(roomId).get(id).fetch(...)`** (stub forwards WebSocket upgrade to the DO).
2. **DO class** — extend **`SockaWebSocketDO`**; **`SockaDoSession`** handlers use **Drizzle** on **`drizzle(ctx.storage)`** (see [chatroom-do](../../../examples/chatroom-do)).
3. **One DO instance per room** — history lives in that object’s SQLite; no **`room_id`** column needed if the table is per-DO.

---

## Full-stack examples (chat + tic-tac-toe)

| Topic | Stack | Folder | Port |
|-------|--------|--------|------|
| Chat + history | **Bun** + SQLite | [`chatroom-bun`](../../../examples/chatroom-bun) | **3464** |
| Chat + history | **Hono + Node** + JSON | [`chatroom-hono`](../../../examples/chatroom-hono) | **3465** |
| Chat + history | **DO** + Drizzle SQLite | [`chatroom-do`](../../../examples/chatroom-do) | **3466** |
| Tic-tac-toe | **Bun** | [`tic-tac-toe-bun`](../../../examples/tic-tac-toe-bun) | **3461** |
| Tic-tac-toe | **Hono + Node** | [`tic-tac-toe-hono`](../../../examples/tic-tac-toe-hono) | **3462** |
| Tic-tac-toe | **DO** | [`tic-tac-toe-do`](../../../examples/tic-tac-toe-do) | **3463** |

---

Next: [Peers](./peers.md) · [Multi-room](./multi-room.md) · [Server](./server.md) · [Durable Objects](./durable-objects.md) · [Client](./client.md) · [Reference](./reference.md) · [Internals](./internals.md)
