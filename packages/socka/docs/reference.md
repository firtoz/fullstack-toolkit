# Reference

User-facing **API** and **configuration**. For **wire protocol details** (frame kinds, transport layers, `decodeSockaWire`), see **[Internals](./internals.md)**.

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

## Wire encoding: JSON and msgpack

- Set **`wireFormat`** to the **same value** on the **client** and on **every server session** for that connection. Default is **`"json"`** (UTF-8 **text** WebSocket frames).
- **`"msgpack"`** uses **binary** frames; use it only when **both** ends opt in.
- **RPCs and typed pushes** share one encoding — there is no separate “push encoding.”

Tradeoffs (bundle size, CPU, debuggability): **[Wire format](./wire-format.md)**.

Tables, logical frame kinds (`clientRequest`, `serverResponse`, …), and **`dispatchSockaInboundMessage`** details: **[Internals](./internals.md)**.

## RPC handler errors

Throw **`SockaError`** from handlers when you control the **message** sent on the **`serverError`** frame. Any other thrown value is wrapped in **`SockaError`** using the original **`Error.message`** when possible, otherwise **`"Handler failed"`**. The client rejects the matching RPC with **`SockaError`**; the wire carries a string **message** only.

## Server session configuration

**`SockaWebSocketSessionConfig`** (`@firtoz/socka/server`, Bun, Hono) and **`SockaDoSessionConfig`** (`@firtoz/socka/do`) share the same fields except **`createData`** (see below).

| Field | Purpose |
|--------|---------|
| **`contract`** | `defineSocka(...)` — `calls`, optional `pushes`. |
| **`wireFormat`** | `"json"` (default) or `"msgpack"` — must match clients. |
| **`handlers`** | Typed call implementations; arity follows input schema (see [Getting started](./getting-started.md)). |
| **`handleClose`** | Async per-socket teardown; runs **before** removal from `sessions` (see [Lifecycle](./lifecycle.md)). |
| **`createData`** | Builds **`session.data`**. **`SockaWebSocketSession`**: **`(init: SockaWebSocketInit) => T`** or, with **`strictUpgradeRequest: true`**, **`(init: SockaStrictWebSocketInit) => T`** so **`init.request`** is always set — see **[Server](./server.md)**. **`SockaDoSession`**: **`(ctx: Context) => T`** — see **[Durable Objects](./durable-objects.md)**. |
| **`strictUpgradeRequest`** | When **`true`**, **`createData`** receives **`SockaStrictWebSocketInit`** ( **`init.request` required** ). Omitted = **`SockaWebSocketInit`** with optional **`request`**. See **[Server — Strict upgrade request](./server.md#strict-upgrade-request)**. |
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
| **`reconnect`** | **`false`** or backoff options — default **on** for **`url`**, **off** for injected **`webSocket`** unless overridden. See **[Reconnection](./reconnection.md)**. |
| **`onReconnecting` / `onReconnected`** | Reconnect lifecycle (**`SockaWebSocketClient`** / **`SockaSession`**). |
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
