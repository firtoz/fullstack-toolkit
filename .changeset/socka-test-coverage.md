---
"socka": patch
---

Add **bun test** coverage: `SockaWebSocketClient` / `SockaRpc`, React hooks and provider (happy-dom preload), and **`createSockaRpcProxyFromSession`** now takes `RefObject<SockaRpc<TContract> | null>` for correct typing. New **`tests/socka-do-test`** runs JSON + msgpack round-trips against Durable Objects (Vitest pool workers).
