---
name: socka/standard-schema
description: Use Standard Schema V1 for WebSocket wire validation in socka (Zod, Valibot, or any compatible library)—not Zod-only APIs.
---

# Socka: Standard Schema wire validation

## When to use

You are validating JSON **client** and **server** messages for `socka/client`, `socka/react`, or `socka/do`. Prefer **Standard Schema V1** (`@standard-schema/spec`) so callers can pass **Zod** (via Zod’s Standard Schema support), **Valibot**, or other implementations.

## Rules

- Pass `StandardSchemaV1` instances into `SockaWebSocketClient` / `SockaRpc` / `useSocka` / `useSockaRpc` and `SockaDoSession` / `SockaWebSocketDO` session options—**not** raw Zod types in socka’s public surface.
- From Zod v4 schemas, use `fromZod(schema)` from **`socka/zod`**. Valibot v1 exposes `~standard`; use **`fromValibot(schema)`** from **`socka/valibot`** so TypeScript treats them as `StandardSchemaV1` in socka APIs.
- Use **`defineSockaRpcSpec`** + **`useSockaRpc`** for correlated RPC; **discriminated unions** on the wire should use **`exhaustiveGuard`** from `@firtoz/maybe-error` in `switch` defaults.

## Tiers

- **Tier 1**: `SockaRpc` / `SockaDoSession` with explicit schemas and manual dispatch.
- **Tier 2**: **`defineSockaRpcSpec`** + **`useSockaRpc`** (or `defineProcedures` + `createRpc` if you need low-level control).
- **Tier 3**: **`useSockaRpc`** with React; DO helpers from **`socka/do`** when they fit your `BaseWebSocketDO` flow.

## Do not

- Re-export symbols from `@firtoz/websocket-do` through socka; import transport (`BaseWebSocketDO`, etc.) from **websocket-do** directly when needed.
