---
"@firtoz/websocket-do": patch
"@firtoz/collection-sync": patch
---

Optional `createData` on `BaseSessionHandlers`: when omitted, `startFresh` initializes session `data` as `{}`.

**@firtoz/collection-sync:** `connectSync` / `connect-partial-sync` attach error logging to async `StandardSchemaWebSocketClient.send` so outbound validation failures are not unhandled promise rejections.
