---
"@firtoz/websocket-do": major
---

**BREAKING**: Migrated from inheritance-based to composition-based architecture

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
