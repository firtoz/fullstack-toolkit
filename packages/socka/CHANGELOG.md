# @firtoz/socka

## 1.0.0

### Minor Changes

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`7eb49ad`](https://github.com/firtoz/fullstack-toolkit/commit/7eb49adb100ffc5187a1f858b013b151db82643f) Thanks [@firtoz](https://github.com/firtoz)! - Initial release of **@firtoz/socka** (Socka): Standard Schema–first WebSocket RPC for browsers and servers (Node **`ws`**, Bun, Hono, Cloudflare Workers, and Cloudflare Durable Objects).

  ### Core and wire

  - **`@firtoz/socka/core`** (same symbols as root **`import "@firtoz/socka"`**): `defineSocka({ calls, pushes? })` with `InferSockaSend`, `InferSockaHandlers`, `InferSockaPushHandlers`, `InferSockaPushPayload`, and `ValidateSockaCallKeys`. Reserved **call** names are only those that would make `session.send` thenable or clash with `Object.prototype` / `constructor` (e.g. `then`, `catch`, `toString`)—not session field names like `close` or `send`, since calls live under `session.send.*`. Socka v1 wire envelopes; `SockaError`, `SockaWireError`; `decodeSockaWire` / encoding helpers.
  - **Wire encoding**: default JSON text frames; optional `wireFormat: "msgpack"` on client and server (same logical frames via **msgpackr**). **`dispatchSockaInboundMessage`** shared with **`attachSockaWebSocket`**.
  - **Pushes**: contract **`pushes`** with **`emitPush`** / **`broadcastPush`** (async, Standard Schema validation); client **`session.subscribe`** — **`on` / `off` / `once` / `waitForPush`**; **`pushHandlers`** at construction; **`SockaPushSession`**, **`runSockaSessionOnAttached`**, **`onAttached`** on session configs. **`autoConnect: false`** with **`connect()`**; **`send`** awaits connect when deferred.
  - **Observability**: optional **`reportError`** with discriminated **`SockaReportError`**. Validation uses **`parseStandardSchema`** directly.

  ### Client and React

  - **`@firtoz/socka/client`**: **`SockaSession`** (typed **`session.send`** / **`session.subscribe`** / **`session.client`**), **`SockaWebSocketClient`**; Node **`ws`** interop (JSON as UTF-8 **`ArrayBuffer`**); msgpack **`Uint8Array`** copied to **`ArrayBuffer`** before **`send`** for DOM typing.
  - **`@firtoz/socka/react`**: **`useSockaSession`**, **`SockaSessionProvider`**, **`useSockaSessionContext`**; **`createSockaSendProxyFromSession`** with **`RefObject<SockaSession<TContract> | null>`**.

  ### Server adapters

  - **`@firtoz/socka/server`**: **`SockaWebSocketSession`**, **`attachSockaWebSocket`** for standard **`WebSocket`** stacks.
  - **`@firtoz/socka/bun`**: **`createSockaBunWebSocketHandlers`**, multi-room **`resolveScope`**.
  - **`@firtoz/socka/hono`**: **`sockaHonoNodeWs`** (**`@hono/node-ws`**); optional **`resolveScope(c)`**.
  - **`@firtoz/socka/hono/cloudflare`**: **`sockaHonoCloudflare`** for **`hono/cloudflare-workers`**.
  - **Handlers**: session-first — calls with input use **`(input, session)`**; without input use **`(session)`** only. **`handleClose`** is session-aware; adapters call **`invokeHandleClose()`** before removing sockets from the map. **`onHandlerError`** receives **`session`** as the fourth argument. **`SockaDoSession`** delegates wire handling to the shared session implementation; optional **`createData`** when **`TData`** is empty (**`Record<string, never>`**).

  ### Durable Objects

  - **`@firtoz/socka/do`**: **`SockaDoSession`**, **`SockaWebSocketDO`**. Document **`session.data`** / **`session.update()`** for hibernation.

  ### Tests and docs

  - **`bun test`** coverage for client, session, React, and integration fixtures.
  - In-repo **docs** (`packages/socka/docs/*`): getting started, peers, server, Durable Objects, multi-room, lifecycle, client, pushes, reference, comparison; package README and examples.

  No schema-library adapters required — **Zod**, **Valibot**, **ArkType**, or any **Standard Schema v1** implementation works directly.

### Patch Changes

- Updated dependencies [[`ffee5b3`](https://github.com/firtoz/fullstack-toolkit/commit/ffee5b313d073366a10e049dc988c9a9c95719be), [`7eb49ad`](https://github.com/firtoz/fullstack-toolkit/commit/7eb49adb100ffc5187a1f858b013b151db82643f), [`e1c08cb`](https://github.com/firtoz/fullstack-toolkit/commit/e1c08cb803574654d5808a984e358258c4171698), [`d35e718`](https://github.com/firtoz/fullstack-toolkit/commit/d35e718bf3292258c2b0006affc7aad5ecc35208), [`d35e718`](https://github.com/firtoz/fullstack-toolkit/commit/d35e718bf3292258c2b0006affc7aad5ecc35208)]:
  - @firtoz/websocket-do@12.0.0
