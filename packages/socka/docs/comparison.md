# Compared to hand-rolled WebSocket RPC

Most apps model messages as large discriminated unions (`type` + `id`), validate twice (once on the wire, once in the handler), and maintain a **pending `Map<string, Deferred>`** for every RPC. That works, but types drift between client and server, correlation IDs are easy to get wrong, and pushing **server events** becomes a second, parallel protocol.

| | Typical custom protocol | socka |
|---|------------------------|--------|
| **Strengths** | Total control; any framing; no shared spec | One contract drives **client + server** types; **Standard Schema** everywhere; socka v1 **envelopes** + correlation built in; inferred **`rpc`** / **`handlers`** |
| **Tradeoffs** | Boilerplate, duplicated schemas, `Promise<unknown>` unless you invest | Opinionated **socka v1** shape; **named procedures** (not a free-form message bus); first-class paths are **browser + Cloudflare DO** and **`socka/server` on a standard WebSocket** |

## When a custom protocol still wins

- You must match **legacy bytes**, a **binary codec** outside JSON/msgpack, or a **non-JSON** framing already deployed in the field.
- You need a **generic pub/sub** bus where message types are not known at compile time.
- You are **not** using TypeScript on both ends and do not benefit from shared inference.

## When socka is a good fit

- You want **schema-first RPC** with **correlated request/response** and optional **typed server push** without maintaining parallel unions.
- You share a **contract module** between client and server (or generate types from it).
- You are fine with **socka v1** frames (see **[Reference](./reference.md)**) so you can swap runtimes (Bun, Hono, DO, Node **`ws`**) behind the same procedures.
