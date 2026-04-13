---
"socka": minor
---

**Breaking change (pre-1.0):** Server RPC handlers now take the session as an explicit argument. Procedures with input use `(input, session)`; procedures without input use `(session)` only. `InferSockaHandlers` requires a second type parameter: the session class (`SockaWebSocketSession<…>` or `SockaDoSession<…>`). `onHandlerError` receives the same `session` as the fourth argument. Durable Object handlers run on the outer `SockaDoSession` (including `data` and `update()`).
