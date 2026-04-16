# Library internals

This page is for **contributors** and readers who want the **wire protocol** and implementation edges. If you only need to **use** socka, start with **[Getting started](./getting-started.md)** and **[Reference](./reference.md)**.

**Source (monorepo paths):**

- Logical frames and **`decodeSockaWire`** — [`packages/socka/src/core/envelope.ts`](../../src/core/envelope.ts)
- JSON vs msgpack **transport** (`encodeSockaWire`, **`parseWirePayload`**) — [`packages/socka/src/core/wire-codec.ts`](../../src/core/wire-codec.ts)
- Inbound dispatch — [`packages/socka/src/server/dispatchSockaInboundMessage.ts`](../../src/server/dispatchSockaInboundMessage.ts)

---

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

---

## Logical frames (socka v1)

Every decoded payload is one logical socka **v1** object. **`decodeSockaWire`** checks shape after `JSON.parse` (text) or msgpack unpack (binary).

| Kind | Role |
|------|------|
| `clientRequest` | Client → server RPC (`id`, `rpc`, `body`) |
| `serverResponse` | Success reply (correlated by `id`) — **omitted** when the contract call has **no** **`output`** (fire-and-forget success); see **[Reference](./reference.md)** |
| `serverError` | Correlated failure (`id`, **`error`** string; optional **`code`**, **`data`**, **`rpc`**) — **`rpc`** names the procedure when the failure is tied to an RPC |
| `serverEvent` | Server push (`event`, `body`) — **not** tied to an RPC `id` |

Clients generate **`id`** strings per request; servers echo them on **`serverResponse`** (when the call declares **`output`**) and on **`serverError`**. **`serverEvent`** uses the contract **`pushes`** map and **`session.subscribe`** on the client.

---

## TypeScript: `SockaWebSocketDO` and contract erasure

`@firtoz/socka/do` **erases** the contract slot on **`SockaWebSocketDO`** so concrete `defineSocka(...)` contracts stay strict under TypeScript. If a generic base class rejects your session type, keep using **your** contract type from the module where you called **`defineSocka`**—do not expect an unconstrained `SockaContract<SockaContractConfig>` to accept every concrete contract without that erasure.

---

## Inbound path (server)

**`attachSockaWebSocket`** uses **`dispatchSockaInboundMessage`** with the same `data` shape as a DOM **`MessageEvent`** (`string`, **`ArrayBuffer`**, **`Blob`**, **`ArrayBufferView`**, or **`Buffer`** on Node/Bun). If you handle **`message`** yourself, call **`dispatchSockaInboundMessage(session, wireFormat, data)`** with matching **`wireFormat`**.

See also [Reference](./reference.md) for **`SockaWebSocketSessionConfig`** fields and [Server](./server.md) for adapters.
