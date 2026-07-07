---
name: do-session
description: SockaDoSession and SockaWebSocketDO on Cloudflare Durable Objects—contract, handlers, wireFormat, SockaError; extends websocket-do BaseSession.
---

# Socka Durable Objects

## Components

- **`SockaDoSession`** (**`@firtoz/socka/do`**): extends **`BaseSession`** from **`@firtoz/websocket-do`**. Incoming messages are decoded with **`decodeSockaWire`** after JSON parse (text) or **`parseWirePayload`** (msgpack). Valid **`clientRequest`** frames are dispatched to **`handlers`** (typed **`InferSockaHandlers<typeof contract>`**). Calls **with** **`output`** get **`encodeServerResponse`** on success; calls **without** **`output`** send **`encodeServerError`** only on failure; optional **`encodeServerEvent`** for contract pushes.
- **`SockaWebSocketDO`**: extend with **`protected readonly contract`**, **`buildSockaSessionConfig(ctx)`** (constructor only when you need extra setup, e.g. DB migrate). Default session wiring is built-in; use **`SockaWebSocketDOBase`** only for a custom **`SockaDoSession`** subclass.

## Session config (`SockaDoSessionConfig`)

- **`contract`**: from **`defineSocka`**.
- **`wireFormat`**: **`"json"`** (default) or **`"msgpack"`**—must match the browser **`SockaWebSocketClient`/`SockaSession`** **`wireFormat`**.
- **`createData`**: optional when session **`TData`** is empty (**`Record<string, never>`**); defaults to **`{}`**. Otherwise Hono **`Context`** → per-connection state.
- **`handlers`**: call name → async/sync handler; inputs and optional outputs validated with Standard Schema via **`parseStandardSchema`** (omit **`output`** in the contract for fire-and-forget success; handler still runs on the server).
- **`handleClose`**: cleanup when the socket closes.
- **`onHandlerError`**, **`onValidationError`**: optional hooks (validation and handler failures are also mapped to **`serverError`** frames).
- **`serializeJson`**, **`deserializeJson`**: optional; default **`JSON.stringify`/`JSON.parse`** for JSON mode.

## Errors

- Throw **`SockaError`** from handlers for domain failures; the session maps the message to a **`serverError`** frame so the client can **`instanceof SockaError`** when using **`SockaSession`**.

## Client parity

- Same **`defineSocka`** contract on the client: **`useSockaSession`**, **`SockaSessionProvider`**, or **`SockaSession`** with matching **`wireFormat`**.

## Transport

- Raw WebSocket lifecycle stays in **`@firtoz/websocket-do`**. Socka adds schema validation and socka v1 framing at the session boundary. Do **not** re-export websocket-do symbols from socka—import **`BaseWebSocketDO`** / **`BaseSession`** from **`@firtoz/websocket-do`** when you need them.
