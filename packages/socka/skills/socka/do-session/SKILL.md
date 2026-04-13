---
name: socka/do-session
description: SockaDoSession and SockaWebSocketDO on Cloudflare Durable Objects—contract, handlers, wireFormat, SockaError; extends websocket-do BaseSession.
---

# Socka Durable Objects

## Components

- **`SockaDoSession`** (**`socka/do`**): extends **`BaseSession`** from **`@firtoz/websocket-do`**. Incoming messages are decoded with **`decodeSockaWire`** after JSON parse (text) or **`parseWirePayload`** (msgpack). Valid **`clientRequest`** frames are dispatched to **`handlers`** (typed **`InferSockaHandlers<typeof contract>`**). Responses use **`encodeServerResponse`** / **`encodeServerError`**; optional **`encodeServerEvent`** for contract events.
- **`SockaWebSocketDO`**: thin **`BaseWebSocketDO`** wrapper; you supply **`createSockaSession(ctx, websocket)`** returning a **`SockaDoSession`** (or subclass).

## Session config (`SockaDoSessionConfig`)

- **`contract`**: from **`defineSocka`**.
- **`wireFormat`**: **`"json"`** (default) or **`"msgpack"`**—must match the browser **`SockaWebSocketClient`/`SockaRpc`** **`wireFormat`**.
- **`createData`**: optional when session **`TData`** is empty (**`Record<string, never>`**); defaults to **`{}`**. Otherwise Hono **`Context`** → per-connection state.
- **`handlers`**: procedure name → async/sync handler; inputs/outputs validated with Standard Schema via **`parseStandardSchema`**.
- **`handleClose`**: cleanup when the socket closes.
- **`onHandlerError`**, **`onValidationError`**: optional hooks (validation and handler failures are also mapped to **`serverError`** frames).
- **`serializeJson`**, **`deserializeJson`**: optional; default **`JSON.stringify`/`JSON.parse`** for JSON mode.

## Errors

- Throw **`SockaError`** from handlers for domain failures; the session maps the message to a **`serverError`** frame so the client can **`instanceof SockaError`** when using **`SockaRpc`**.

## Client parity

- Same **`defineSocka`** contract on the client: **`useSockaRpc`**, **`SockaRpcProvider`**, or **`SockaRpc`** with matching **`wireFormat`**.

## Transport

- Raw WebSocket lifecycle stays in **`@firtoz/websocket-do`**. Socka adds schema validation and socka v1 framing at the session boundary. Do **not** re-export websocket-do symbols from socka—import **`BaseWebSocketDO`** / **`BaseSession`** from **`@firtoz/websocket-do`** when you need them.
