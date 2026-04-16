# Recipes (copy-paste)

Minimal wiring per runtime. Each assumes a **`defineSocka`** contract and matching client **`SockaSession`**. Full apps: **[chatroom-bun](../../examples/chatroom-bun)** (Bun SQLite), **[chatroom-hono](../../examples/chatroom-hono)** (Hono JSON), **[chatroom-do](../../examples/chatroom-do)** (Durable Object SQLite).

## Multi-room Bun (`Bun.serve`)

Use **`createSockaRoomRegistry`** + **`createSockaBunWebSocketHandlers({ resolveScope })`** — see **[chatroom-bun](../../examples/chatroom-bun/src/server.ts)**.

```ts
import { createSockaBunWebSocketHandlers, sockaBunUpgrade } from "@firtoz/socka/bun";
import { createSockaRoomRegistry } from "@firtoz/socka/server";

const rooms = createSockaRoomRegistry((roomId, _sessionMap) => ({
  contract: myContract,
  createData: (init) => { /* parse init.request */ return { roomId: "…" }; },
  handlers: { /* … */ },
  handleClose: async () => {},
}));

const { websocket } = createSockaBunWebSocketHandlers({
  resolveScope(ws) {
    const room = rooms.get(ws.data.roomId);
    return { sessionMap: room.sessionMap, config: room.config };
  },
});

Bun.serve({
  fetch(req, srv) {
    if (req.url.includes("/ws/")) {
      const roomId = "…";
      if (sockaBunUpgrade(srv, req, { roomId })) return undefined;
      return new Response("upgrade failed", { status: 400 });
    }
    return new Response("OK");
  },
  websocket,
});
```

## Single-room Bun

One **`sessionMap`** and one **`config`** — use **`createSockaBunWebSocketHandlers(myConfig)`** without **`resolveScope`**.

## Hono on Node (`@hono/node-ws`)

**`createNodeWebSocket`** + **`sockaHonoNodeWs`** — see **[chatroom-hono](../../examples/chatroom-hono/src/server.ts)**.

```ts
import { sockaHonoNodeWs } from "@firtoz/socka/hono";
import { createSockaRoomRegistry } from "@firtoz/socka/server";

const rooms = createSockaRoomRegistry((roomId) => ({ /* config */ }));

app.get("/ws/:roomId", upgradeWebSocket((c) => {
  const room = rooms.get(c.req.param("roomId") ?? "default");
  return sockaHonoNodeWs(room.config, { sessions: room.sessionMap })(c);
}));
```

## Hono on Cloudflare Workers

**`upgradeWebSocket`** from **`hono/cloudflare-workers`** + **`sockaHonoCloudflare`** — session often starts on first **`onMessage`**; see **[Server](./server.md#firtoz-socka-hono-cloudflare-workers)**.

## Durable Objects

Subclass **`SockaWebSocketDO`**, implement **`createSockaSession`** returning **`SockaDoSession`** — see **[Durable Objects](./durable-objects.md)** and **[chatroom-do](../../examples/chatroom-do/src/do.ts)**.

## Client (browser)

```ts
import { SockaSession } from "@firtoz/socka/client";

const session = new SockaSession({ contract: myContract, url: "wss://…/ws/room" });
await session.send.list();
```

React: **`useSockaSession`** / **`useSocka`** / **`useSockaPresence`** — see **[Client](./client.md)**.
