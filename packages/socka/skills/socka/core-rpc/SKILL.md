---
name: "@firtoz/socka/core-rpc"
description: Standard Schema socka contracts (defineSocka), v1 wire envelopes, SockaSession/SockaWebSocketClient, React useSockaSession and SockaSessionProvider, SockaError.
---

# Socka core: RPC

## Contract

- **`defineSocka`** in **`@firtoz/socka/core`**: pass **`calls`** (and optional **`pushes`**) with **`StandardSchemaV1`** `input` / `output` per call. Types flow from **`InferSockaSend`**, **`InferSockaHandlers`**, **`InferSockaPushHandlers`**.
- There is **no** `defineSockaProtocol` / `defineSockaRpcSpec` in socka—those names belong to other stacks; use **`defineSocka`** only.

## Browser client

- **`SockaWebSocketClient`** / **`SockaSession`** in **`@firtoz/socka/client`**: constructed with **`contract`**, **`url`** or **`webSocket`**, optional **`wireFormat`**: **`"json"`** (default, text frames) or **`"msgpack"`** (binary `ArrayBuffer`—must match the server). Optional **`pushHandlers`** for server **`serverEvent`** frames (typed from the contract). On **`SockaSession`**, call contract methods as **`await session.send.echo(...)`** (same shape as **`useSockaSession`**’s **`send`**); use **`session.subscribe`** for push subscriptions.
- **`SockaError`**: thrown on correlated RPC failures when using **`SockaSession`** (check **`instanceof SockaError`**).

## React

- **`useSockaSession(contract, options, deps)`** in **`@firtoz/socka/react`**: returns **`{ ready, send, sessionRef }`**. **`send`** exposes typed call methods (e.g. **`send.list()`**). Pass **`pushHandlers`** in **`options`** for contract **pushes** (not a separate “server push” table).
- **`useSocka(options, deps)`**: lower level; **`sessionRef`** to **`SockaSession`** if you build **`send`** yourself.
- **Single shared socket**: wrap the tree with **`SockaSessionProvider`** (same props as **`useSockaSession`** plus **`children`**), then call **`useSockaSessionContext(contract)`** in descendants. Pass the **same `contract` reference** as the provider; the hook checks reference equality.

## Wire

- Every frame is a **socka v1** object validated by **`decodeSockaWire`** (`socka`, **`v`**, discriminators, **`id`**, **`rpc`**, **`body`**, …). Invalid payloads become **`SockaWireError`** (or **`onValidationError`** on the client).
- RPC success → **`serverResponse`**; RPC failure → **`serverError`**; server pushes → **`serverEvent`** with event name + **`body`**.
- **JSON vs msgpack** is a transport choice only; the logical shape is identical. **Client and DO must use the same `wireFormat`.**

## Durable Objects

- **`SockaDoSession`** / **`SockaWebSocketDO`** in **`@firtoz/socka/do`**—see **`@firtoz/socka/do-session`** skill.

## Low-level

- Use **`@firtoz/socka/core`** helpers (**`encodeClientRequest`**, **`decodeSockaWire`**, **`encodeSockaWire`**, **`parseWirePayload`**) only if you bypass **`SockaSession`** / **`SockaDoSession`**.
