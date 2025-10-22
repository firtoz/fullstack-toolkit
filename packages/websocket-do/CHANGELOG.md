# @firtoz/websocket-do

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
