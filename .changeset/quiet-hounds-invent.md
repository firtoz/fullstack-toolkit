---
"@firtoz/websocket-do": major
"@firtoz/collection-sync": patch
"@firtoz/drizzle-durable-sqlite": patch
---

**@firtoz/websocket-do:** Replace Zod-only `ZodSession`, `ZodWebSocketClient`, `ZodWebSocketDO`, and `zodMsgpack` with Standard Schema v1–based `StandardSchemaSession`, `StandardSchemaWebSocketClient`, `StandardSchemaWebSocketDO`, and `standardSchemaMsgpack`. Add `parseStandardSchema` and a direct dependency on `@standard-schema/spec`. Subpath `./zod-client` is removed; use `./schema-client`. Client `send` is now async (`Promise<void>`). Server session `send`/`broadcast` stay `void` with async validation under the hood. Remove the experimental `@firtoz/websocket-do/ws-rpc-protocol` export; use **`socka/core`** (`defineSocka`, typed RPC) instead.

**@firtoz/collection-sync:** `connectSync` / `connect-partial-sync` now use `StandardSchemaWebSocketClient` from `@firtoz/websocket-do/schema-client`.

**@firtoz/drizzle-durable-sqlite:** `SyncableDurableObject` and `QueryableDurableObject` extend `StandardSchemaWebSocketDO` / `StandardSchemaSession` and use `createStandardSchemaSession` / `standardSchemaSessionOptions` in constructors.
