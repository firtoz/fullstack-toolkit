# Reconnection

**`SockaWebSocketClient`** and **`SockaSession`** share the same reconnect options (sessions forward them to the client).

## Defaults

- **`url` mode** — Reconnect is **on** with exponential backoff + jitter, **infinite** attempts, and **pause while `document.hidden`** (when **`document`** exists).
- **Injected `webSocket`** — Reconnect is **off** by default (typical for tests). Pass an explicit **`reconnect`** object to enable it for a mocked socket.

Set **`reconnect: false`** to disable entirely.

## Options (`SockaReconnectConfig`)

| Field | Default | Notes |
|-------|---------|--------|
| **`initialDelayMs`** | `1000` | First delay after a close that triggers reconnect. |
| **`maxDelayMs`** | `30000` | Cap for the backoff curve. |
| **`jitter`** | `0.2` | Fraction of the delay to randomize (0–1). |
| **`maxAttempts`** | *omitted* | Omit for **infinite** attempts. |
| **`pauseWhenHidden`** | `true` | Wait until the tab is visible again before reconnecting (browser). |

Delay grows exponentially from **`initialDelayMs`** up to **`maxDelayMs`**, then jitter is applied.

## Lifecycle callbacks

| Callback | When |
|----------|------|
| **`onReconnecting`** | Before a delayed attempt is scheduled (**`attempt`**, **`delayMs`**). |
| **`onReconnected`** | After a **new** socket reaches **`open`** following a reconnect (**`attempt`**). |

Use **`onReconnected`** to **re-hydrate** client state: call **`listHistory`**, **`listPresence`**, or your own snapshot RPCs — in-memory UI state may be stale across a new socket.

## Stopping the loop

**`session.close()`** / **`client.close()`** performs a **manual** close: the client sets an internal flag so **abnormal-close reconnect** does not run afterward. Use this for user-driven “disconnect” or cleanup.

## Pending RPCs

Pending calls at disconnect time **reject** (same as without reconnect). There is no built-in queue across disconnects; re-issue work after **`onReconnected`** or **`waitForOpen()`** if needed.

## See also

- **[Client](./client.md)** — lifecycle and React remounting when changing URL/room.
- **[Testing](./testing.md)** — injected **`WebSocket`** fakes in tests.
