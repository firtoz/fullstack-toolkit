# @firtoz/websocket-do

## 13.0.1

### Patch Changes

- Updated dependencies [[`1e057aa`](https://github.com/firtoz/fullstack-toolkit/commit/1e057aad4b252223f4269a9bc6bd01a744cf56a8)]:
  - @firtoz/hono-fetcher@2.7.1

## 13.0.0

### Minor Changes

- [`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd) Thanks [@firtoz](https://github.com/firtoz)! - Publish compiled ESM and TypeScript declarations from `dist/` for each package (`tsup`, `prepack` build). `exports`, `main`, and `types` resolve to `dist/`; CLI bins point at built JS with a Node shebang where applicable. Shared `scripts/tsup-lib.ts` discovers `src` entries and externals; workspace test apps map `@firtoz/*` to package sources in `tsconfig` for accurate generics during typecheck. `@firtoz/socka` is published under the scoped name with the same `dist/` layout.

### Patch Changes

- [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe) Thanks [@firtoz](https://github.com/firtoz)! - Improve READMEs: npm shields, contextual stack badges, clearer taglines, and new docs for `@firtoz/idb-collections` and `@firtoz/collection-sync`. Align `@firtoz/db-helpers` copy with published `dist/` builds.

- Updated dependencies [[`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd), [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe)]:
  - @firtoz/hono-fetcher@2.7.0

## 12.0.0

### Major Changes

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`e1c08cb`](https://github.com/firtoz/fullstack-toolkit/commit/e1c08cb803574654d5808a984e358258c4171698) Thanks [@firtoz](https://github.com/firtoz)! - **@firtoz/websocket-do:** `BaseSessionHandlers.handleClose` and `StandardSchemaSessionHandlers.handleClose` receive the session instance (aligned with DO teardown).

  **@firtoz/drizzle-durable-sqlite:** `handleClose` handlers on bundled DO session wiring match the session-aware `BaseSession` contract.

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`d35e718`](https://github.com/firtoz/fullstack-toolkit/commit/d35e718bf3292258c2b0006affc7aad5ecc35208) Thanks [@firtoz](https://github.com/firtoz)! - **@firtoz/websocket-do:** Replace Zod-only `ZodSession`, `ZodWebSocketClient`, `ZodWebSocketDO`, and `zodMsgpack` with Standard Schema v1–based `StandardSchemaSession`, `StandardSchemaWebSocketClient`, `StandardSchemaWebSocketDO`, and `standardSchemaMsgpack`. Add `parseStandardSchema` and a direct dependency on `@standard-schema/spec`. Subpath `./zod-client` is removed; use `./schema-client`. Client `send` is now async (`Promise<void>`). Server session `send`/`broadcast` stay `void` with async validation under the hood. Remove the experimental `@firtoz/websocket-do/ws-rpc-protocol` export; use **`socka/core`** (`defineSocka`, typed RPC) instead.

  **@firtoz/collection-sync:** `connectSync` / `connect-partial-sync` now use `StandardSchemaWebSocketClient` from `@firtoz/websocket-do/schema-client`.

  **@firtoz/drizzle-durable-sqlite:** `SyncableDurableObject` and `QueryableDurableObject` extend `StandardSchemaWebSocketDO` / `StandardSchemaSession` and use `createStandardSchemaSession` / `standardSchemaSessionOptions` in constructors.

### Minor Changes

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`7eb49ad`](https://github.com/firtoz/fullstack-toolkit/commit/7eb49adb100ffc5187a1f858b013b151db82643f) Thanks [@firtoz](https://github.com/firtoz)! - Add `@firtoz/websocket-do/rpc` (`StandardSchemaWebSocketRpcSession`, `createStandardSchemaWebSocketRpcSession`) for pending-map WebSocket RPC over Standard Schema–validated messages, and `@firtoz/websocket-do/rpc-react` with `useStandardSchemaWebSocketRpc` for React (connection lifecycle, `ready`, stable `sessionRef`). Optional peer `react` is documented for the React entry only.

### Patch Changes

- [#71](https://github.com/firtoz/fullstack-toolkit/pull/71) [`ffee5b3`](https://github.com/firtoz/fullstack-toolkit/commit/ffee5b313d073366a10e049dc988c9a9c95719be) Thanks [@firtoz](https://github.com/firtoz)! - Add `zod` as a dev dependency so `examples/client-usage.ts` typechecks during package CI.

- [#70](https://github.com/firtoz/fullstack-toolkit/pull/70) [`d35e718`](https://github.com/firtoz/fullstack-toolkit/commit/d35e718bf3292258c2b0006affc7aad5ecc35208) Thanks [@firtoz](https://github.com/firtoz)! - Optional `createData` on `BaseSessionHandlers`: when omitted, `startFresh` initializes session `data` as `{}`.

  **@firtoz/collection-sync:** `connectSync` / `connect-partial-sync` attach error logging to async `StandardSchemaWebSocketClient.send` so outbound validation failures are not unhandled promise rejections.

## 11.0.0

### Major Changes

- **Standard Schema v1** replaces Zod-only APIs: `StandardSchemaSession`, `StandardSchemaWebSocketClient`, `StandardSchemaWebSocketDO`, `standardSchemaMsgpack`, and `parseStandardSchema`. Schemas are `StandardSchemaV1` from `@standard-schema/spec` (Zod 4, Valibot, ArkType, etc.). Subpath **`./zod-client` is removed**; use **`./schema-client`**. **`StandardSchemaWebSocketClient.send`** is now **`async`** (`Promise<void>`).

## 10.0.0

### Patch Changes

- Updated dependencies [[`9a38d77`](https://github.com/firtoz/fullstack-toolkit/commit/9a38d77c5502ea10d6104918afd3527ffbfbb82d)]:
  - @firtoz/hono-fetcher@2.6.0

## 9.0.0

### Patch Changes

- Updated dependencies [[`fb45a10`](https://github.com/firtoz/fullstack-toolkit/commit/fb45a1056cdca508e3670b611bfcdf833efb5070)]:
  - @firtoz/hono-fetcher@2.5.0

## 8.0.1

### Patch Changes

- Updated dependencies [[`05d3b24`](https://github.com/firtoz/fullstack-toolkit/commit/05d3b244f081c634e3128b558f0ad4cbb261fb56)]:
  - @firtoz/hono-fetcher@2.4.1

## 8.0.0

### Patch Changes

- Updated dependencies [[`0cd07e4`](https://github.com/firtoz/fullstack-toolkit/commit/0cd07e4e87ed6302b3de652c0a2a25e68cb41820)]:
  - @firtoz/hono-fetcher@2.4.0

## 7.1.0

### Minor Changes

- [#64](https://github.com/firtoz/fullstack-toolkit/pull/64) [`556555a`](https://github.com/firtoz/fullstack-toolkit/commit/556555a2e09030a8658be8c07b5881e72be64b2f) Thanks [@firtoz](https://github.com/firtoz)! - Add `@firtoz/websocket-do/zod-client` so browser bundles can import `ZodWebSocketClient` without pulling Durable Object worker modules from the package root.

## 7.0.1

### Patch Changes

- [`b84d9ee`](https://github.com/firtoz/fullstack-toolkit/commit/b84d9ee3cdb60e3e0bb78eb7415dbf4886f8a302) Thanks [@firtoz](https://github.com/firtoz)! - Updated peer dependency:

  - `hono`: ^4.11.3 → ^4.11.4

- Updated dependencies [[`b84d9ee`](https://github.com/firtoz/fullstack-toolkit/commit/b84d9ee3cdb60e3e0bb78eb7415dbf4886f8a302)]:
  - @firtoz/hono-fetcher@2.3.2

## 7.0.0

### Major Changes

- [`8edcbdc`](https://github.com/firtoz/fullstack-toolkit/commit/8edcbdc008aab12d416b23f90d7f59ebf75ef969) Thanks [@firtoz](https://github.com/firtoz)! - **BREAKING**: Migrated from inheritance-based to composition-based architecture

  **Before (6.x):**

  ```typescript
  class MySession extends BaseSession<...> {
    protected createData(ctx: Context) { ... }
    async handleMessage(message: ClientMessage) { ... }
    async handleClose() { ... }
  }

  class MyDO extends BaseWebSocketDO<Env, MySession> {
    protected createSession(websocket: WebSocket) {
      return new MySession(websocket, this.sessions);
    }
  }
  ```

  **After (7.x):**

  ```typescript
  class MySession extends BaseSession<...> {
    constructor(websocket: WebSocket, sessions: Map<WebSocket, MySession>) {
      super(websocket, sessions, {
        createData: (ctx) => ({ ... }),
        handleMessage: async (message) => { ... },
        handleBufferMessage: async (message) => { ... },
        handleClose: async () => { ... },
      });
    }
  }

  class MyDO extends BaseWebSocketDO<MySession, Env> {
    constructor(ctx: DurableObjectState, env: Env) {
      super(ctx, env, {
        createSession: (ctx, websocket) => new MySession(websocket, this.sessions),
      });
    }
  }
  ```

  **Major Breaking Changes:**

  - **`BaseSession`** is now a concrete class accepting `BaseSessionHandlers` in constructor

    - `createData`, `handleMessage`, `handleBufferMessage`, `handleClose` are now provided via handlers
    - Methods `send()` and `broadcast()` are now `public` instead of `protected`

  - **`BaseWebSocketDO`** now requires `BaseWebSocketDOOptions` in constructor

    - `createSession` is now passed as an option instead of being an abstract method
    - Type parameter order changed from `<TEnv, TSession>` to `<TSession, TEnv>`

  - **`ZodSession`** is now a concrete class accepting `ZodSessionHandlers` in constructor

    - `handleValidatedMessage` and `handleValidationError` are now provided via handlers
    - `clientSchema`, `serverSchema`, `enableBufferMessages` moved to options parameter
    - Methods `send()` and `broadcast()` are now `public` instead of `protected`

  - **`ZodWebSocketDO`** now requires `ZodWebSocketDOOptions` in constructor
    - `createZodSession` is now passed as an option instead of being an abstract method
    - `zodSessionOptions` is now part of the options parameter

  **New Features:**

  - Added `sendProtocolError` option to `ZodSessionOptions` for customizable protocol error handling
  - Added new exported types: `BaseSessionHandlers`, `BaseWebSocketDOOptions`, `ZodSessionHandlers`, `ZodWebSocketDOOptions`

  **Migration Guide:**

  See the updated README.md for complete examples with the new API. The main changes are:

  1. Pass handlers in constructor instead of implementing abstract methods
  2. Use composition pattern with options objects
  3. Update type parameter order for DO classes
  4. Update visibility assumptions (send/broadcast are now public)

## 6.0.2

### Patch Changes

- [`60a6a3d`](https://github.com/firtoz/fullstack-toolkit/commit/60a6a3da58de1a7b0210ef6ad2fb12047d3d5be0) Thanks [@firtoz](https://github.com/firtoz)! - Try to fix workspace ref

## 6.0.1

### Patch Changes

- [`e879407`](https://github.com/firtoz/fullstack-toolkit/commit/e8794074e3803b45cbf1d754b99b5cfb82e7fb2c) Thanks [@firtoz](https://github.com/firtoz)! - fix npmrc

- Updated dependencies [[`e879407`](https://github.com/firtoz/fullstack-toolkit/commit/e8794074e3803b45cbf1d754b99b5cfb82e7fb2c)]:
  - @firtoz/hono-fetcher@2.3.1

## 6.0.0

### Minor Changes

- [`0317659`](https://github.com/firtoz/fullstack-toolkit/commit/0317659a87fa7be9bb47130fe6ad8004562fd277) Thanks [@firtoz](https://github.com/firtoz)! - Try fixing catalogs maybe

### Patch Changes

- Updated dependencies [[`0317659`](https://github.com/firtoz/fullstack-toolkit/commit/0317659a87fa7be9bb47130fe6ad8004562fd277)]:
  - @firtoz/hono-fetcher@2.3.0

## 5.0.0

### Minor Changes

- [`8f7ddf7`](https://github.com/firtoz/fullstack-toolkit/commit/8f7ddf7a200a5b4133ba16f32b9d46da97a8344d) Thanks [@firtoz](https://github.com/firtoz)! - Try using catalog for deps in monorepo

### Patch Changes

- Updated dependencies [[`8f7ddf7`](https://github.com/firtoz/fullstack-toolkit/commit/8f7ddf7a200a5b4133ba16f32b9d46da97a8344d)]:
  - @firtoz/hono-fetcher@2.2.0

## 4.0.0

### Minor Changes

- [`c38877a`](https://github.com/firtoz/fullstack-toolkit/commit/c38877a21b3879eb41ae457aac35ea9d5eac6db7) Thanks [@firtoz](https://github.com/firtoz)! - Add zod-based helpers to websocket-do

### Patch Changes

- Updated dependencies [[`c38877a`](https://github.com/firtoz/fullstack-toolkit/commit/c38877a21b3879eb41ae457aac35ea9d5eac6db7)]:
  - @firtoz/hono-fetcher@2.1.0

## 3.0.0

### Patch Changes

- [`8b85af2`](https://github.com/firtoz/fullstack-toolkit/commit/8b85af2940ae002fb376885bedfbfb341950b29c) Thanks [@firtoz](https://github.com/firtoz)! - Improve README documentation and remove local test scripts

- Updated dependencies [[`8b85af2`](https://github.com/firtoz/fullstack-toolkit/commit/8b85af2940ae002fb376885bedfbfb341950b29c)]:
  - @firtoz/hono-fetcher@2.0.0

## 2.0.0

### Patch Changes

- Updated dependencies [[`fd76fb4`](https://github.com/firtoz/fullstack-toolkit/commit/fd76fb447b82ccaafd2722a0cdcd9a6abcec25b5)]:
  - @firtoz/hono-fetcher@1.1.0

## 1.0.0

### Major Changes

- [`8a5ca48`](https://github.com/firtoz/fullstack-toolkit/commit/8a5ca4836a2a1655cf0ef0f828e52a0c74efd7dd) Thanks [@firtoz](https://github.com/firtoz)! - Moving to @firtoz

### Patch Changes

- Updated dependencies [[`8a5ca48`](https://github.com/firtoz/fullstack-toolkit/commit/8a5ca4836a2a1655cf0ef0f828e52a0c74efd7dd)]:
  - @firtoz/hono-fetcher@1.0.0

## 0.0.0

### Initial Release

- Initial implementation of WebSocket Durable Object utilities
- Added `BaseWebSocketDO` for managing WebSocket connections in Cloudflare Durable Objects
- Added `BaseSession` for type-safe session management
- Added `WebsocketWrapper` for typed WebSocket message handling
- Integrated with Hono for routing and context management
