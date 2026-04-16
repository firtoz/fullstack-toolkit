---
"@firtoz/socka": minor
---

- Add **`SockaStrictWebSocketInit`** and **`strictUpgradeRequest`** so Bun/Hono adapters can type **`createData`** with a real **`Request`** (no `http://_/` placeholder).
- Add **`createSockaRoomRegistry`**, **`listPeers`** / **`listPeersWith`** on **`SockaWebSocketSession`** / **`SockaDoSession`**, and optional exponential-backoff **reconnect** on **`SockaWebSocketClient`** / **`SockaSession`** with **`onReconnecting`** / **`onReconnected`**.
- **Hono** **`sockaHonoNodeWs`** defaults **`sockaInit`** from the request context when omitted.
- **`useSocka`** React hook is documented; new docs for reconnection, presence, history, testing, wire-format tradeoffs, and backpressure; README and docs hub updated.
