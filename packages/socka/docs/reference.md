# Reference

## Type inference

```ts
import type { InferSockaSend, InferSockaHandlers } from "@firtoz/socka/core";

type Send = InferSockaSend<typeof myContract>;
type Handlers = InferSockaHandlers<
  typeof myContract,
  SockaWebSocketSession<typeof myContract>
>;
```

**`InferSockaSend`** — Call names become methods on **`session.send`**; inputs/outputs follow the contract. **`InferSockaHandlers`** — Server handler arity matches **`calls`** (with or without `input`).

## Errors and observability

| Concern | Hook |
|--------|------|
| Exceptions inside **RPC handlers** | `onHandlerError` on `SockaWebSocketSessionConfig` / `SockaDoSessionConfig` |
| Invalid **inbound wire** payloads (before your handler runs) | `onValidationError` on the same config |
| Everything else ( **`onAttached`** failures, adapter I/O, **client** push listener throws, **client** push payload validation) | Optional **`reportError(event)`** on `SockaWebSocketSessionConfig`, `SockaDoSessionConfig`, or `SockaSession` / `useSockaSession` options |

Each **`event`** is **`SockaReportError`**: one discriminated union (`kind` narrows context; **`error`** is the thrown/rejected value; **`eventName`** / **`adapter`** where relevant). Export: **`@firtoz/socka/core`** (`defaultReportError`, `reportSockaError`). If you omit **`reportError`**, socka uses **`console.error`** with the same **`socka:`**-prefixed messages as before.

## TypeScript: Durable Objects and session types

`@firtoz/socka/do` **erases** the contract slot on **`SockaWebSocketDO`** so concrete `defineSocka(...)` contracts stay strict under TypeScript. If a generic base class rejects your session type, keep using **your** contract type from the module where you called **`defineSocka`**—do not expect an unconstrained `SockaContract<SockaContractConfig>` to accept every concrete contract without that erasure.

## Wire encoding: JSON and msgpack

Socka has two layers: **transport encoding** (how each WebSocket frame is serialized) and **logical frames** (the socka v1 object inside). Both sides must agree on **`wireFormat`** or decoding fails immediately (wrong frame type or parse errors).

| `wireFormat` | WebSocket frame | Bytes on the wire |
|--------------|-----------------|-------------------|
| **`"json"`** (default) | **Text** — `send(string)` | UTF-8 JSON of the **whole** envelope (one JSON object per frame). Uses **`serializeJson`** / **`deserializeJson`** when set, otherwise `JSON.stringify` / `JSON.parse`. |
| **`"msgpack"`** | **Binary** — `send(ArrayBuffer)` | [msgpack](https://msgpack.org/) of the same envelope object graph. In the browser, **`SockaWebSocketClient`** sets **`binaryType = "arraybuffer"`** so binary frames decode correctly. |

**Rules**

- Set **`wireFormat`** to the **same value** on the **client** (`SockaSession` / `SockaWebSocketClient` / `useSockaSession` options) and on **every server session** that talks to that client (`SockaWebSocketSessionConfig`, `SockaDoSessionConfig`, and the `config` passed to **`createSockaBunWebSocketHandlers`**, **`sockaHonoNodeWs`**, **`sockaHonoCloudflare`**, etc.).
- **RPCs and contract pushes** share one encoding: `clientRequest` / `serverResponse` / `serverError` / `serverEvent` are all wrapped the same way.
- If you use **`dispatchSockaInboundMessage`** manually, pass the same **`wireFormat`** as the peer used to **encode** the frame.
- Optional **`serializeJson`** / **`deserializeJson`** on client or server config only affect **JSON mode** (the outer envelope). Call **`body`** and push **`body`** values are still whatever your **Standard Schema** accepts after JSON/msgpack decode.

## Logical frames (socka v1)

Every decoded payload is one logical socka **v1** object. **`decodeSockaWire`** checks shape after `JSON.parse` (text) or msgpack unpack (binary).

| Kind | Role |
|------|------|
| `clientRequest` | Client → server RPC (`id`, `rpc`, `body`) |
| `serverResponse` | Success reply (correlated by `id`) |
| `serverError` | Correlated failure (`id`, `error` message string) |
| `serverEvent` | Server push (`event`, `body`) — **not** tied to an RPC `id` |

Clients generate **`id`** strings per request; servers echo them on **`serverResponse`** and **`serverError`** so concurrent RPCs never mix results. **`serverEvent`** uses the contract **`pushes`** map and **`session.subscribe`** on the client.

### Handler errors

Throw **`SockaError`** from handlers when you control the **message** sent on the **`serverError`** frame. Any other thrown value is wrapped in **`SockaError`** using the original **`Error.message`** when possible, otherwise **`"Handler failed"`**. The client rejects the matching RPC with **`SockaError`**; the wire carries a string **message** only.

## Server session configuration

**`SockaWebSocketSessionConfig`** (`@firtoz/socka/server`, Bun, Hono) and **`SockaDoSessionConfig`** (`@firtoz/socka/do`) share the same fields except **`createData`** (see below).

| Field | Purpose |
|--------|---------|
| **`contract`** | `defineSocka(...)` — `calls`, optional `pushes`. |
| **`wireFormat`** | `"json"` (default) or `"msgpack"` — must match clients. |
| **`handlers`** | Typed call implementations; arity follows input schema (see [Getting started](./getting-started.md)). |
| **`handleClose`** | Async per-socket teardown; runs **before** removal from `sessions` (see [Lifecycle](./lifecycle.md)). |
| **`createData`** | Builds **`session.data`**. **`SockaWebSocketSession`**: **`(init: SockaWebSocketInit) => T`** (e.g. **`init.request`** from upgrade). **`SockaDoSession`**: **`(ctx: Context) => T`** — see **[Durable Objects](./durable-objects.md)**. |
| **`onAttached`** | Optional: after registration in `sessions` (safe for broadcasts). |
| **`onHandlerError`** | Observes thrown errors in handlers (after optional `SockaError` wrapping for the wire). |
| **`onValidationError`** | Inbound frame failed schema / wire decode before your handler. |
| **`reportError`** | Non-RPC failures (`onAttached`, adapters, …); see **Errors and observability** above. |
| **`serializeJson` / `deserializeJson`** | Replace JSON stringify/parse for **JSON wire mode** only. |

## Client configuration

| Field | Purpose |
|--------|---------|
| **`contract`** | Same module reference as the server. |
| **`url`** | `new WebSocket(url)` when **`webSocket`** is omitted. |
| **`webSocket`** | Inject an existing socket (tests or custom setup); **`url`** not required if set. |
| **`wireFormat`** | Must match the server session (**default `"json"`**). |
| **`autoConnect`** | Default **`true`**. If **`false`**, call **`connect()`** before **`session.send`** (or rely on implicit open from **`send`**). |
| **`serializeJson` / `deserializeJson`** | Same as server — JSON wire mode only. |
| **`onOpen` / `onClose` / `onError`** | WebSocket lifecycle. |
| **`onValidationError`** | Inbound frame failed validation (**`SockaWebSocketClient`**). |
| **`pushHandlers`** | Initial **`session.subscribe`** subscriptions (**`SockaSession`** only). |
| **`reportError`** | Client pipeline failures (listeners, validation); see **Errors and observability**. |

**`SockaSession`** passes unrecognized options through to **`SockaWebSocketClient`** except **`pushHandlers`** and **`reportError`** (handled at the session layer). React hooks mirror these options — see **[Client](./client.md)**.

## Schema libraries

Anything that implements **Standard Schema v1** works — **Zod**, **Valibot**, **ArkType**, or a custom implementation. Pass schemas straight into **`defineSocka`**; no adapter helpers required.

## At a glance

| | |
|---:|---|
| **Contract** | `defineSocka({ calls, pushes? })` — Zod, Valibot, ArkType, or any [Standard Schema v1](https://standardschema.dev/) |
| **Client** | `SockaSession` / `useSockaSession` / `SockaSessionProvider` + `useSockaSessionContext` |
| **Server** | `SockaDoSession` + `SockaWebSocketDO` on Durable Objects, or **`@firtoz/socka/server`** / **`@firtoz/socka/bun`** / **`@firtoz/socka/hono`** on any supported runtime |
| **Wire** | JSON text frames by default; optional **msgpack** binary — same logical frames, both ends must use the same `wireFormat` |

### Imports

| Path | Use for |
|------|---------|
| `@firtoz/socka` | Same as **`@firtoz/socka/core`** — `defineSocka`, wire helpers, errors, types (prefer explicit **`/core`** in examples) |
| `@firtoz/socka/core` | `defineSocka`, wire helpers, `SockaError`, `SockaReportError`, `reportSockaError`, types |
| `@firtoz/socka/client` | `SockaSession`, `SockaWebSocketClient` (also re-exports `SockaReportError`, `reportSockaError`) |
| `@firtoz/socka/react` | `useSocka`, `useSockaSession`, provider + context |
| `@firtoz/socka/do` | `SockaDoSession`, `SockaWebSocketDO` |
| `@firtoz/socka/server` | `SockaWebSocketSession`, `attachSockaWebSocket`, `dispatchSockaInboundMessage`, `broadcastSockaEventToPeers` |
| `@firtoz/socka/bun` | `createSockaBunWebSocketHandlers` for **`Bun.serve`** |
| `@firtoz/socka/hono` | `sockaHonoNodeWs` for **`@hono/node-ws`** |
| `@firtoz/socka/hono/cloudflare` | `sockaHonoCloudflare` for **`hono/cloudflare-workers`** |
