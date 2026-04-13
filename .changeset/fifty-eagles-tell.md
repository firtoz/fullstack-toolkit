---
"@firtoz/socka": major
---

**Breaking:** Remove stringly `emitEvent` / `broadcastEvent` from sessions; use **`emitContractEvent`** / **`broadcastContractEvent`** (async, Standard Schema validation). Add **`SockaPushSession`**, **`InferSockaEventPayload`**, **`runSockaSessionOnAttached`**, and **`onAttached`** on session configs (wired through attach/Bun/Hono/DO).

**Client:** **`autoConnect: false`** with **`connect()`**; **`SockaRpc.events`** **`on` / `off` / `once` / `waitForEvent`**; **`eventHandlers`** still registers the same listeners at construction. RPC **`call()`** awaits **`connect()`** when deferred.
