# Authentication and authorization

Socka does not ship a built-in auth layer: you decide **who** may open a WebSocket and **what** each RPC may do. Typical patterns:

## Read credentials on upgrade

- **`@firtoz/socka/server`** — by default **`createData`** receives **`SockaStrictWebSocketInit`**; read **`init.request`** (cookies via **`Cookie`**, **`Authorization`**, URL query, path segments).
- **`SockaDoSession`** with **`createData: (ctx) => …`** — use Hono **`ctx.req`**, **`ctx.get("…")`**, or **`ctx.req.raw.headers`**.

Reject before returning session data: throw **`SockaError`** with **`{ code, data }`** so the client receives a correlated **`serverError`** frame (see **[Reference — RPC handler errors](./reference.md#rpc-handler-errors)**).

## Browsers and the WebSocket API

The browser **`WebSocket`** constructor cannot set arbitrary headers on the handshake. Common approaches:

- **Cookie** — `SameSite` cookies sent automatically to your origin; read them in **`createData`** from **`init.request`**.
- **Query string** — `wss://app.example.com/ws/room?token=…` (treat tokens as secrets; prefer short-lived tokens and HTTPS/WSS only).
- **Subprotocol** — rarely needed; socka uses its own wire framing on the same socket.

## After the socket is open

You can also enforce auth inside **RPC handlers** using **`session.data`** (set in **`createData`**) and return **`SockaError`** for forbidden operations.

## See also

- **[Multi-room](./multi-room.md)** — scoping **`sessionMap`** per tenant/room.
- **[Client](./client.md)** — lifecycle and reconnect; re-auth after reconnect may repeat **`listHistory`** / snapshot RPCs.
