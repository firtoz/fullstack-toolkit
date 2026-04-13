---
name: socka/standard-schema
description: Standard Schema v1 for socka contracts and wire validation—Zod, Valibot, or any compatible library; no Zod-only public surface.
---

# Socka: Standard Schema wire validation

## When to use

You define **procedure** `input` / `output` (and optional **event** payloads) for **`socka/core`**, **`socka/client`**, **`socka/react`**, and **`socka/do`**. Every schema slot expects **`StandardSchemaV1`** from **`@standard-schema/spec`** so callers can use **Zod**, **Valibot**, **ArkType**, etc., without socka-specific adapters.

## Rules

- Pass **`StandardSchemaV1`** instances into **`defineSocka`** procedure/event definitions. **`SockaWebSocketClient`**, **`SockaRpc`**, **`useSocka`**, **`useSockaRpc`**, **`SockaRpcProvider`**, and **`SockaDoSession`** all consume the resulting **`SockaContract`**—not raw library types on socka’s public API.
- **Zod v4** and **Valibot** expose Standard Schema natively; you typically pass schemas **directly** into **`defineSocka`** (no `fromZod` / `fromValibot` helpers required—see package README).
- For correlated RPC, use **`defineSocka`** + **`useSockaRpc`** / **`SockaRpc`** / **`SockaDoSession`**.
- For **your own** discriminated unions in domain types, use **`exhaustiveGuard`** from **`@firtoz/maybe-error`** in **`switch`** defaults so new variants fail at compile time.

## Tiers

- **Typical**: **`defineSocka`** → **`SockaRpc`** or **`useSockaRpc`** (or **`SockaRpcProvider`** + **`useSockaRpcContext`**) on the client; **`SockaDoSession`** with the same contract on the DO.
- **Lower level**: **`SockaWebSocketClient`** with callbacks, or **`socka/core`** encode/decode helpers if you implement custom glue.

## Do not

- Re-export symbols from **`@firtoz/websocket-do`** through socka; import transport primitives from **websocket-do** directly when needed.
