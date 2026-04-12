---
name: socka/core-rpc
description: Correlated WebSocket RPC with defineSockaProtocol or defineSockaRpcSpec, socka v1 wire frames, SockaError, and useSockaRpc.
---

# Socka core: RPC

## Preferred path

- **`defineSockaProtocol`** in **`socka/core`**: bundles Standard Schema client/server + the same procedure table as **`defineSockaRpcSpec`** (`name`, `prefix`, `build`, `successType`, `extractResult`).
- **`useSockaRpc`** in **`socka/react`**: pass **`protocol`**; returns **`rpc`** with typed methods (`rpc.list()`, etc.) plus **`SockaError`** on correlated failures (`instanceof SockaError`).
- **`serverPushHandlers`** (optional) on **`useSockaRpc`** for server-initiated messages keyed by `msg.type`.

## Wire

- Every **JSON text** frame on the socket must be a **socka v1** envelope (`socka`, `v: 1`, …). Invalid payloads surface as **`SockaWireError`** (or your **`onValidationError`** handler on the client).
- RPC success uses **`serverResponse`**; RPC failure uses **`serverError`**; other server→client domain messages use **`serverEvent`** with the full domain object in **`body`**.

## Low-level (advanced)

- **`defineProcedures`**, **`createRpc`**, **`rejectPending`**, **`rejectPendingSocka`**, **`RpcSessionLike`** when you need full control.

## Types

- Client and server message types should include `{ type: string; id: string }` where RPC uses correlation ids.
- Error wire uses `{ type: "error"; id: string; error: string }` for **`SockaError`** mapping.
