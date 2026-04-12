---
name: socka/do-session
description: SockaDoSession and SockaWebSocketDO on Cloudflare Durable Objects with Standard Schema–validated ingress and egress; use SockaError for RPC failures.
---

# Socka Durable Objects

## Components

- **`SockaDoSession`**: Extends websocket-do **`BaseSession`**; validates incoming messages with a **client** Standard Schema, outgoing with a **server** schema (JSON-first). Implement `handleValidatedMessage`; throw **`SockaError`** for business failures and map to `{ type: "error", id, error }` before `send` so browsers reject with **`instanceof SockaError`** when using **`defineSockaRpcSpec`** / **`useSockaRpc`**.
- **`SockaWebSocketDO`**: Wires `sockaSessionOptions` and `createSockaSession` like `ZodWebSocketDO` but Standard Schema–first.

## Transport

- Raw WebSocket behavior remains in **`@firtoz/websocket-do`**. Socka adds validation at the session boundary.

## Client parity

- Browser: **`defineSockaRpcSpec`** + **`useSockaRpc`** with the same logical client/server schemas.
