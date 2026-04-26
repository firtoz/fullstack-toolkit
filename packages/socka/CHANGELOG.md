# @firtoz/socka

## 3.0.3

### Patch Changes

- [`0615c27`](https://github.com/firtoz/fullstack-toolkit/commit/0615c275c65474b57b7650bf8e82674818855055) Thanks [@firtoz](https://github.com/firtoz)! - Documentation: add React + Cloudflare Durable Objects and collaborative-realtime guides; call `output` decision table in README; expand client/reference/pushes/durable-objects with SSR WebSocket URLs, `InferSockaPushHandlers`, `exactOptionalPropertyTypes` notes, fire-and-forget observability, and `SockaDoSession` app typing.

- [`c1d45f1`](https://github.com/firtoz/fullstack-toolkit/commit/c1d45f119845e9ff97cbab010a9120cddff7f392) Thanks [@firtoz](https://github.com/firtoz)! - Fix generic contract bounds: add `SockaContractConfigBound` / `SockaContractBound` and use them (with `InferSocka*` helpers) so `defineSocka` contracts **with** server `pushes` assign to `SockaDoSession`, `SockaSession`, and related APIs. The previous `extends SockaContract<SockaContractConfig>` shape incorrectly required `pushes` to match `Record<string, never>`.

## 3.0.2

### Patch Changes

- [`bf246d7`](https://github.com/firtoz/fullstack-toolkit/commit/bf246d7ae9c1555886d39aab56378bc024d82c14) Thanks [@firtoz](https://github.com/firtoz)! - Align WebSocket close handling with Cloudflare’s pre- and post–2026-04-07 close semantics: complete the Close handshake with the peer’s `code`/`reason` in `webSocketClose`, and make `webSocketError` close idempotent. Add optional `pairServerWebSocketAcceptOptions` on `BaseWebSocketDO` / `StandardSchemaWebSocketDO` and `SockaWebSocketDO` for `WebSocket#accept` (e.g. `allowHalfOpen`), and optional `acceptOptions` on the hono fetcher’s WebSocket config for the same.

- Updated dependencies [[`bf246d7`](https://github.com/firtoz/fullstack-toolkit/commit/bf246d7ae9c1555886d39aab56378bc024d82c14)]:
  - @firtoz/websocket-do@13.0.2

## 3.0.1

### Patch Changes

- Updated dependencies []:
  - @firtoz/websocket-do@13.0.1

## 3.0.0

### Major Changes

- [`42b43de`](https://github.com/firtoz/fullstack-toolkit/commit/42b43de1427a01288a9ab0053c244db20a5bd8cc) Thanks [@firtoz](https://github.com/firtoz)! - **Breaking:** Strict HTTP upgrade is the default for `SockaWebSocketSession`. `createData` receives `SockaStrictWebSocketInit` unless you use `SockaWebSocketSessionConfigLoose` with `strictUpgradeRequest: false` (tests, Node `ws` without a `Request`, inner DO engine). New types: `SockaWebSocketSessionConfigLoose`, `SockaWebSocketSessionConfigUnion`. Sessions constructed without an upgrade `Request` now throw unless loose.

### Minor Changes

- [`0e07b4c`](https://github.com/firtoz/fullstack-toolkit/commit/0e07b4ccf7146289ea0d754fcfff56ebbcf098d1) Thanks [@firtoz](https://github.com/firtoz)! - Optional `output` on `defineSocka` calls enables fire-and-forget RPC: no `serverResponse` on success, client `send` resolves after the request is sent; failures still use `serverError` with optional `rpc`. `SockaError` and `reportError` gain related fields/kinds. Documentation updated (`z.void()` vs omitted `output`).

### Patch Changes

- [`d9657ba`](https://github.com/firtoz/fullstack-toolkit/commit/d9657baef5517c8dea08ba9f3a467d157fdde7e1) Thanks [@firtoz](https://github.com/firtoz)! - Set `ignoreDeprecations` to `6.0` in `tsconfig.json` so the declaration build succeeds on TypeScript 6 (silences TS5101 for deprecated `baseUrl` used by the DTS pipeline).

## 2.1.0

### Minor Changes

- [`021ed8e`](https://github.com/firtoz/fullstack-toolkit/commit/021ed8e5beb64ff4123f8def65b42863c5844f39) Thanks [@firtoz](https://github.com/firtoz)! - **Strict upgrade:** **`SockaStrictWebSocketInit`** and **`strictUpgradeRequest`** so **`createData`** can use a real **`Request`** (Bun/Hono). **`sockaBunInitFromWsData`**; **`sockaHonoNodeWs`** can default **`sockaInit`** from context.

  **Core:** **`createSockaRoomRegistry`**; **`listPeers`** / **`listPeersWith`**; optional reconnect with backoff on **`SockaWebSocketClient`** / **`SockaSession`** (**`onReconnecting`** / **`onReconnected`**).

  **DX:** **`sockaBunUpgrade`** on Bun; examples use **`createSockaRoomRegistry`** + upgrade helper; **`peerCount`** / **`hasPeers`** on sessions; **`@firtoz/socka/test`** exports **`createFakeWebSocket`**.

  **Client:** **`SockaConnectionStatus`** via **`status`** + **`onStatusChange`**; React **`useSocka`** / **`useSockaSession`** / context return **`status`**, **`reconnecting`**, **`reconnectAttempt`**; **`useSockaPresence`** hook.

  **Wire:** **`serverError`** frames may include optional **`code`** and **`data`**; **`SockaError`** carries them through from handler throws. Older peers ignore missing fields.

  **Docs:** **`docs/auth.md`**, **`docs/recipes.md`**, reconnection, presence, history, testing, wire-format, backpressure; README and docs hub updates.

  **Repo:** Removed root **`codegen`** script; re-tracked **`worker-configuration.d.ts`** and Drizzle generated bundles where applicable; **`turbo.json`** runs **`typegen`** / **`db:generate`** before **`typecheck`** / **`build`**; CI verifies **`git diff`** is clean after checks.

### Patch Changes

- Updated dependencies [[`7c4983f`](https://github.com/firtoz/fullstack-toolkit/commit/7c4983fd27adb9709ee844547259e0f22040fded)]:
  - @firtoz/maybe-error@1.6.1

## 2.0.0

### Minor Changes

- [`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd) Thanks [@firtoz](https://github.com/firtoz)! - Publish compiled ESM and TypeScript declarations from `dist/` for each package (`tsup`, `prepack` build). `exports`, `main`, and `types` resolve to `dist/`; CLI bins point at built JS with a Node shebang where applicable. Shared `scripts/tsup-lib.ts` discovers `src` entries and externals; workspace test apps map `@firtoz/*` to package sources in `tsconfig` for accurate generics during typecheck. `@firtoz/socka` is published under the scoped name with the same `dist/` layout.

### Patch Changes

- [`6950c53`](https://github.com/firtoz/fullstack-toolkit/commit/6950c531f643c3f8d404266624afe9d25200be30) Thanks [@firtoz](https://github.com/firtoz)! - Unify the **npm** story on **`@firtoz/socka`**: clarify _Socka_ (product) vs scoped package in README/docs/changelog, add root **`exports["."]`** plus **`main`**/**`types`** pointing at compiled **`dist/`** (same entry as **`/core`**), extend **`description`** for all supported runtimes, stop shipping **`src/`** in the published tarball (consumers resolve **ESM + `.d.ts`** only), and align peers copy with the scoped name.

- [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe) Thanks [@firtoz](https://github.com/firtoz)! - Improve READMEs: npm shields, contextual stack badges, clearer taglines, and new docs for `@firtoz/idb-collections` and `@firtoz/collection-sync`. Align `@firtoz/db-helpers` copy with published `dist/` builds.

- [`2a975ec`](https://github.com/firtoz/fullstack-toolkit/commit/2a975ec03bc2d24ec31a9c99613c4e01ef217174) Thanks [@firtoz](https://github.com/firtoz)! - Docs: painkiller-first README with a complete Bun hello-world; align `description` with all runtimes; streamline getting-started and peers; fix comparison tradeoff wording.

- Updated dependencies [[`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd), [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe)]:
  - @firtoz/maybe-error@1.6.0
  - @firtoz/websocket-do@13.0.0

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
