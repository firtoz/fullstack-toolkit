---
"@firtoz/websocket-do": patch
"@firtoz/hono-fetcher": patch
"@firtoz/socka": patch
---

Align WebSocket close handling with Cloudflare’s pre- and post–2026-04-07 close semantics: complete the Close handshake with the peer’s `code`/`reason` in `webSocketClose`, and make `webSocketError` close idempotent. Add optional `pairServerWebSocketAcceptOptions` on `BaseWebSocketDO` / `StandardSchemaWebSocketDO` and `SockaWebSocketDO` for `WebSocket#accept` (e.g. `allowHalfOpen`), and optional `acceptOptions` on the hono fetcher’s WebSocket config for the same.
