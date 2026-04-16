---
"@firtoz/socka": minor
---

**Strict upgrade:** **`SockaStrictWebSocketInit`** and **`strictUpgradeRequest`** so **`createData`** can use a real **`Request`** (Bun/Hono). **`sockaBunInitFromWsData`**; **`sockaHonoNodeWs`** can default **`sockaInit`** from context.

**Core:** **`createSockaRoomRegistry`**; **`listPeers`** / **`listPeersWith`**; optional reconnect with backoff on **`SockaWebSocketClient`** / **`SockaSession`** (**`onReconnecting`** / **`onReconnected`**).

**DX:** **`sockaBunUpgrade`** on Bun; examples use **`createSockaRoomRegistry`** + upgrade helper; **`peerCount`** / **`hasPeers`** on sessions; **`@firtoz/socka/test`** exports **`createFakeWebSocket`**.

**Client:** **`SockaConnectionStatus`** via **`status`** + **`onStatusChange`**; React **`useSocka`** / **`useSockaSession`** / context return **`status`**, **`reconnecting`**, **`reconnectAttempt`**; **`useSockaPresence`** hook.

**Wire:** **`serverError`** frames may include optional **`code`** and **`data`**; **`SockaError`** carries them through from handler throws. Older peers ignore missing fields.

**Docs:** **`docs/auth.md`**, **`docs/recipes.md`**, reconnection, presence, history, testing, wire-format, backpressure; README and docs hub updates.

**Repo:** Removed root **`codegen`** script; re-tracked **`worker-configuration.d.ts`** and Drizzle generated bundles where applicable; **`turbo.json`** runs **`typegen`** / **`db:generate`** before **`typecheck`** / **`build`**; CI verifies **`git diff`** is clean after checks.
