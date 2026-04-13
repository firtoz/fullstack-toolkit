---
"socka": minor
---

Add `socka/server` with `SockaWebSocketSession` and `attachSockaWebSocket` for standard WebSocket stacks (Hono, Node `ws`, Bun) without Durable Objects. `SockaDoSession` now delegates wire handling to the shared session implementation. README documents non-DO usage.
