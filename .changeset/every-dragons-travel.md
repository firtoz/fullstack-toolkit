---
"@firtoz/socka": major
---

Ships as **4.0.0** (current published line is 3.x). This is a major bump within the 3.x API era, not a continuation of 2.x.

### Breaking changes

- **`SockaWebSocketDO` constructor options** — the **`createSockaSession`** callback is removed. Call **`super(ctx, env)`** (or **`super(ctx, env, { pairServerWebSocketAcceptOptions })`** when you need **`WebSocket#accept`** options). No other session wiring in the constructor.
- **`SockaWebSocketDO` generics** — now **`<TContract, TData, TEnv>`** (three parameters), not **`<TSession, TEnv>`**. Custom session subclasses use **`SockaWebSocketDOBase`** (four parameters) instead.
- **DO owns the contract** — declare **`protected readonly contract = myContract`** on the DO. Do not pass **`contract`** inside per-session config.
- **Session config hook** — implement **`protected buildSockaSessionConfig(ctx)`** returning **`SockaDoSessionConfigInput`** (handlers, **`createData`**, **`handleClose`**, …). **`contract`** is omitted from that return value.
- **Removed `createSockaSession` constructor option** — the base wires **`new SockaDoSession(websocket, host)`** for you. Override **`createSockaSession`** only on **`SockaWebSocketDOBase`** when you need a custom **`SockaDoSession`** subclass (uncommon).

### Migration

**Before (3.x):**

```ts
export class ChatRoomDO extends SockaWebSocketDO<ChatSockaSession, Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, {
      createSockaSession: (_ctx, ws) =>
        new ChatSockaSession(ws, this.sessions, this.buildConfig()),
    });
  }

  private buildConfig(): SockaDoSessionConfig<typeof chatContract, SessionData, Env> {
    return {
      contract: chatContract,
      handlers: { … },
      handleClose: async (session) => { … },
    };
  }
}
```

**After (4.x):**

```ts
export class ChatRoomDO extends SockaWebSocketDO<
  typeof chatContract,
  SessionData,
  Env
> {
  protected readonly contract = chatContract;

  protected buildSockaSessionConfig(
    _ctx: Context<{ Bindings: Env }> | undefined,
  ): SockaDoSessionConfigInput<typeof chatContract, SessionData, Env> {
    return {
      handlers: { … },
      handleClose: async (session) => { … },
    };
  }
}
```

Most apps can **delete** thin **`SockaDoSession`** wrapper classes; handlers live in **`buildSockaSessionConfig`** and close over **`this`** (DB, game state, etc.).

**Hibernation and `createData`** — On a **fresh** WebSocket upgrade, **`createData(ctx)`** runs once with the Hono **`Context`** (headers, query, etc.). On **hibernation resume**, **`@firtoz/websocket-do`** calls **`session.resume()`** only — **`createData` is not re-run**; **`session.data`** comes from the WebSocket attachment. **`buildSockaSessionConfig(undefined)`** runs again to rebuild handlers; that is safe. Call **`session.update()`** after mutating **`session.data`** so resume sees fresh attachment data.

**Room-wide pushes from HTTP / admin routes** — use **`await this.broadcastPushToAll("messageDeleted", { id })`** instead of picking an arbitrary session and calling **`broadcastPush`**. Standalone helper: **`broadcastContractPushToAll(sessions, contract, name, body)`** from **`@firtoz/socka/server`**.

**Custom `SockaDoSession` subclass (rare):** extend **`SockaWebSocketDOBase<TContract, TData, MySession, Env>`** and override **`createSockaSession`**, or use **`new SockaDoSession(ws, do, ctx)`**. The legacy **`(ws, sessions, config)`** constructor remains for tests and non-DO wiring.

See **`packages/socka/docs/durable-objects.md`** and **`examples/chatroom-do/src/do.ts`** for the full pattern.

### Additions (non-breaking API surface)

- **`broadcastPushToAll`** on **`SockaWebSocketDO`** / **`SockaWebSocketDOBase`**
- **`broadcastContractPushToAll`**, **`broadcastSockaEventToAll`** from **`@firtoz/socka/server`**
- **`SockaDoHost`**, **`SockaDoSessionConfigInput`**, host-based **`SockaDoSession`** constructor
