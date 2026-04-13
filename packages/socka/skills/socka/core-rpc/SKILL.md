---
name: socka/core-rpc
description: Standard Schema socka contracts (defineSocka), v1 wire envelopes, SockaRpc/SockaWebSocketClient, React useSockaRpc and SockaRpcProvider, SockaError.
---

# Socka core: RPC

## Contract

- **`defineSocka`** in **`socka/core`**: pass **`procedures`** (and optional **`events`**) with **`StandardSchemaV1`** `input` / `output` per procedure. Types flow from **`InferSockaRpc`**, **`InferSockaHandlers`**, **`InferSockaEventHandlers`**.
- There is **no** `defineSockaProtocol` / `defineSockaRpcSpec` in socka—those names belong to other stacks; use **`defineSocka`** only.

## Browser client

- **`SockaWebSocketClient`** / **`SockaRpc`** in **`socka/client`**: constructed with **`contract`**, **`url`** or **`webSocket`**, optional **`wireFormat`**: **`"json"`** (default, text frames) or **`"msgpack"`** (binary `ArrayBuffer`—must match the server). Optional **`eventHandlers`** for server **`serverEvent`** frames (typed from the contract).
- **`SockaError`**: thrown on correlated RPC failures when using **`SockaRpc`** (check **`instanceof SockaError`**).

## React

- **`useSockaRpc(contract, options, deps)`** in **`socka/react`**: returns **`{ ready, rpc, sessionRef }`**. **`rpc`** exposes typed procedure methods (e.g. **`rpc.list()`**). Pass **`eventHandlers`** in **`options`** for contract **events** (not a separate “server push” table).
- **`useSocka(options, deps)`**: lower level; **`sessionRef`** to **`SockaRpc`** if you build **`rpc`** yourself.
- **Single shared socket**: wrap the tree with **`SockaRpcProvider`** (same props as **`useSockaRpc`** plus **`children`**), then call **`useSockaRpcContext(contract)`** in descendants. Pass the **same `contract` reference** as the provider; the hook checks reference equality.

## Wire

- Every frame is a **socka v1** object validated by **`decodeSockaWire`** (`socka`, **`v`**, discriminators, **`id`**, **`rpc`**, **`body`**, …). Invalid payloads become **`SockaWireError`** (or **`onValidationError`** on the client).
- RPC success → **`serverResponse`**; RPC failure → **`serverError`**; server pushes → **`serverEvent`** with event name + **`body`**.
- **JSON vs msgpack** is a transport choice only; the logical shape is identical. **Client and DO must use the same `wireFormat`.**

## Durable Objects

- **`SockaDoSession`** / **`SockaWebSocketDO`** in **`socka/do`**—see **`socka/do-session`** skill.

## Low-level

- Use **`socka/core`** helpers (**`encodeClientRequest`**, **`decodeSockaWire`**, **`encodeSockaWire`**, **`parseWirePayload`**) only if you bypass **`SockaRpc`** / **`SockaDoSession`**.
