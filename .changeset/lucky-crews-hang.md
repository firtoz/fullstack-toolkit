---
"@firtoz/socka": patch
---

**Bun adapter:** `createSockaBunWebSocketHandlers` now forwards **`SockaWebSocketInit`** when the upgrade stores **`request`** on **`ServerWebSocket` `data`** (e.g. `upgrade(req, { data: { roomId, request: req } })`). Export **`sockaBunInitFromWsData`**. Documentation: multi-room chat README/getting-started, **`listPresence`** in examples + **`listHistory`**, **`clearHistory`** / **`historyCleared`** in contract snippets and chatroom example apps.
