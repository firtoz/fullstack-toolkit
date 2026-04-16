# Testing

## Client: inject a `WebSocket`

In tests, pass **`webSocket`** into **`SockaSession`** or **`SockaWebSocketClient`** with a **fake implementation** of the **`WebSocket`** API (no real network). Import **`createFakeWebSocket`** from **`@firtoz/socka/test`** (same helper the package tests use). Drive **`send`** / **`subscribe`** by delivering **encoded socka frames** (JSON or msgpack per **`wireFormat`**) through the fake’s **`onmessage`** path.

**Reconnect:** With an injected socket, reconnect defaults to **off**; set **`reconnect`** explicitly if you need to test backoff behavior.

## Server: `SockaWebSocketSession` in isolation

Construct **`SockaWebSocketSession`** with a **`SockaWebSocketSessionConfig`** and call **`handleRawMessage`** / **`dispatchSockaInboundMessage`** with encoded frames (see package tests under **`packages/socka/src/server/`**).

## Integration-style

The monorepo may include **`tests/socka-server-test`** (or similar) for end-to-end handler checks against a real upgrade path — run the workspace test target that applies to your change.

## See also

- **[Reference](./reference.md)** — client/server configuration tables.
- **[Internals](./internals.md)** — frame shapes for manual encoding.
