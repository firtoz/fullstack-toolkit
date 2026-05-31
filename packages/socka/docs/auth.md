# Authentication and authorization

Socka does not ship a built-in auth layer: you decide **who** may open a WebSocket and **what** each RPC may do. Typical patterns:

## Reject before upgrade (HTTP 401 / 403)

When identity is attested on a **web worker** and forwarded to the DO (headers, shared secret, signed query), reject **before** `101 Switching Protocols`:

- **`BaseWebSocketDO.beforeWebSocket(ctx)`** — override on your DO (inherited by **`SockaWebSocketDO`**). Return **`401` / `403`** to stop the upgrade; return **`void`** to proceed. Runs before **`WebSocketPair`** is created.
- **Hono middleware** on a chained **`app = this.getBaseApp().use(…)`** — same HTTP semantics for routes you mount before **`/websocket`**.

This is preferable to **`override fetch()`** on the whole DO when you only need to gate the WebSocket path.

## Read credentials after upgrade (`createData`)

- **`@firtoz/socka/server`** — **`createData`** receives **`SockaStrictWebSocketInit`**; read **`init.request`** (cookies, **`Authorization`**, query, path).
- **`SockaDoSession`** with **`createData: (ctx) => …`** — use Hono **`ctx.req`**, **`ctx.get("…")`**, or **`ctx.req.raw.headers`**.

Throwing **`SockaError`** in **`createData`** runs **after** the upgrade (`101` already sent). The client gets a correlated **`serverError`** frame and the socket closes — **not** a clean HTTP rejection. Use this for “connected but not allowed” or when credentials are only available post-upgrade; use **`beforeWebSocket`** when you need HTTP status codes before opening the socket.

## Browsers and the WebSocket API

The browser **`WebSocket`** constructor cannot set arbitrary headers on the handshake. Common approaches:

- **Cookie** — `SameSite` cookies sent automatically to your origin; read them in **`createData`** or validate on the worker and forward attested identity to the DO **`beforeWebSocket`** check.
- **Query string** — `wss://app.example.com/ws/room?token=…` (treat tokens as secrets; prefer short-lived tokens and HTTPS/WSS only).
- **Subprotocol** — rarely needed; socka uses its own wire framing on the same socket.

## After the socket is open

You can also enforce auth inside **RPC handlers** using **`session.data`** (set in **`createData`**) and return **`SockaError`** for forbidden operations.

## See also

- **[Durable Objects](./durable-objects.md)** — chaining HTTP routes on **`app`**.
- **[Multi-room](./multi-room.md)** — scoping **`sessionMap`** per tenant/room.
- **[Client](./client.md)** — lifecycle and reconnect; re-auth after reconnect may repeat snapshot RPCs.
