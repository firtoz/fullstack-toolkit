---
"socka": patch
---

Improve interoperability with Node **`ws`**: JSON frames may arrive as UTF-8 **`ArrayBuffer`** in **`attachSockaWebSocket`** (decoded with **`TextDecoder`**). **`SockaWebSocketClient.sendRequest`** and **`SockaWebSocketSession`** copy msgpack **`Uint8Array`** payloads to **`ArrayBuffer`** before **`WebSocket.send`** for strict DOM typing.
