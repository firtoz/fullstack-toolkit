# Compared to hand-rolled WebSocket RPC (and common alternatives)

Most apps model messages as large discriminated unions (`type` + `id`), validate twice (once on the wire, once in the handler), and maintain a **pending `Map<string, Deferred>`** for every RPC. That works, but types drift between client and server, correlation IDs are easy to get wrong, and pushing **server events** becomes a second, parallel protocol.

## socka vs typical custom protocol

| | Typical custom protocol | socka |
|---|------------------------|--------|
| **Strengths** | Total control; any framing; no shared spec | One contract drives **client + server** types; **Standard Schema** everywhere; socka v1 **envelopes** + correlation built in; inferred **`rpc`** / **`handlers`** |
| **Tradeoffs** | Boilerplate, duplicated schemas, `Promise<unknown>` unless you invest | Opinionated **socka v1** shape; **named procedures** (not a free-form message bus); first-class paths are **browser + Cloudflare DO** and **`@firtoz/socka/server` on a standard WebSocket** |

## socket.io

| | socket.io | socka |
|---|-----------|--------|
| **Model** | Named events + optional ack callbacks; rooms/namespaces are first-class | **Schema-first RPC**: one `defineSocka` contract drives typed **`session.send.*`** and **`handlers`**; optional typed **pushes** |
| **Typing** | Largely **string-based** event names; no built-in shared input/output schema layer across client and server | **Standard Schema v1** on every procedure; **no duplicate schema** layer |
| **When socket.io wins** | Broad ecosystem, Redis adapters, fallbacks, “emit anything” ergonomics | **When you want** correlated request/response + typed contracts in TypeScript on **both** ends |

## tRPC

| | tRPC | socka |
|---|------|--------|
| **Transport** | **HTTP-first** (batching, subscriptions via adapters); WebSocket is **not** the core story | **WebSocket-first** RPC: socka v1 frames on the wire |
| **Contract** | **Router** + procedures; great for HTTP/JSON | **Single shared contract** (`defineSocka`) for **WS** frames (JSON or msgpack) |
| **When tRPC wins** | Same-process or HTTP-first APIs, huge React ecosystem | **When the real transport is WebSocket** (including Durable Objects, Bun, Hono, Node `ws`) and you want **one schema** for the socket |

## When a custom protocol still wins

- You must match **legacy bytes**, a **binary codec** outside JSON/msgpack, or a **non-JSON** framing already deployed in the field.
- You need a **generic pub/sub** bus where message types are not known at compile time.
- You are **not** using TypeScript on both ends and do not benefit from shared inference.

## When socka is a good fit

You want **schema-first WebSocket RPC** with **correlated request/response** and optional **typed server push** from a **single contract module**—and you are fine with **socka v1** frames (see **[Reference](./reference.md)**) so you can swap runtimes (Bun, Hono, Durable Objects, Node **`ws`**) behind the same procedures.
