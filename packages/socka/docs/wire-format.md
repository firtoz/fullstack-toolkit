# Wire format tradeoffs (JSON vs msgpack)

Socka uses one **`wireFormat`** per connection for **both** RPCs and pushes (**default `"json"`**).

## JSON (`"json"`)

- **Pros** — Easy to debug in DevTools; text frames; no extra binary codec in the browser.
- **Cons** — Larger payloads than msgpack for repetitive objects; UTF-8 string overhead.

## MessagePack (`"msgpack"`)

Implemented with **msgpackr** (bundled dependency size ~tens of kb — see your bundler report).

- **Pros** — Smaller frames for structured data; binary **`ArrayBuffer`** WebSocket frames.
- **Cons** — Harder to read in network tabs; must set **`wireFormat: "msgpack"`** on **client and server** for that connection.

## Binary payloads

If you send **raw binary** application data, msgpack mode is a natural fit; keep contract fields as **byte arrays** or **base64** depending on how you want to validate (Standard Schema still applies to decoded values).

## Switching

Set **`wireFormat: "msgpack"`** on **`SockaSession`** / **`SockaWebSocketClient`** and on **`SockaWebSocketSessionConfig`** / **`SockaDoSessionConfig`** for every session that speaks to that client.

**Details:** **[Reference — Wire encoding](./reference.md#wire-encoding-json-and-msgpack)** · **[Internals](./internals.md)**.

## `serverError` and `rpc`

On **`serverError`** frames, **`rpc`** is an optional string naming the procedure when the failure is tied to a client RPC. Servers built on **`SockaWebSocketSession`** include it on correlated errors so clients can attribute failures without relying on a pending **`Map`** entry (needed for fire-and-forget calls that omit **`output`**). Older servers may omit **`rpc`**; clients still receive **`id`** and **`error`**.
