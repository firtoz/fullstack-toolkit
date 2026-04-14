# Client

## Vanilla (`SockaSession`)

Outside React, construct **`SockaSession`** from **`socka/client`** with the same **`contract`** as the server and a **`url`** (or a prebuilt **`webSocket`**). **`wireFormat`** defaults to **`"json"`** and must match every server session that receives this connection.

| Option | Typical use |
|--------|-------------|
| **`contract`**, **`url`** / **`webSocket`** | Required pairing: open socket to your upgrade URL, or inject a socket for tests. |
| **`wireFormat`** | **`"json"`** (text frames) vs **`"msgpack"`** (binary); must match the **server** session config for this connection. |
| **`autoConnect: false`** | Defer opening until **`await session.connect()`** (or first **`send`**). |
| **`serializeJson` / `deserializeJson`** | Custom JSON handling for the **outer** frame in JSON mode (e.g. replacers). |
| **`onOpen` / `onClose` / `onError`** | Lifecycle and telemetry. |
| **`pushHandlers`** | Up-front subscriptions for contract **`pushes`** (same as **`session.subscribe.on`**). |
| **`reportError`** | Non-RPC client pipeline failures; defaults to **`console.error`**. |

Full list: **[Reference — Client configuration](./reference.md#client-configuration)**.

**Call names** — For literal `calls` objects, **`defineSocka`** rejects names that would make **`session.send`** Promise-like or clash with object shape (e.g. **`then`**, **`toString`**). If you use a wide **`Record<string, SockaProcedureDef>`**, TypeScript cannot apply that check; **`SockaSession`** still validates at construction (see **`RESERVED_SOCKA_PROCEDURE_NAMES`** in **`socka/core`**).

```ts
import { SockaSession } from "socka/client";
import { myContract } from "./contract";

const session = new SockaSession({ contract: myContract, url: "wss://example.com/ws" });
const rows = await session.send.list();
```

Use **`SockaWebSocketClient`** directly if you need **`onResponse` / `onServerError` / `onEvent`** frame hooks without **`SockaSession`**’s typed **`send`** / **`subscribe`**; most apps use **`SockaSession`**.

## React

```ts
import { useSockaSession } from "socka/react";
import { myContract } from "./contract";

function App() {
  const { ready, send } = useSockaSession(myContract, { url: "ws://..." }, []);
  // After `ready`, call `send.list()` / `send.insert(...)` from effects or event handlers (not during render).
  return null;
}

// Binary frames — set the same `wireFormat` on the server session
useSockaSession(myContract, { url: "wss://...", wireFormat: "msgpack" }, []);
```

### One WebSocket for the whole tree

If many components need **`send`**, avoid calling **`useSockaSession`** in each one (each call owns a connection). Mount a provider once and read the session from context:

```tsx
import { SockaSessionProvider, useSockaSessionContext } from "socka/react";
import { myContract } from "./contract";

function Layout({ roomId }: { roomId: string }) {
  return (
    <SockaSessionProvider
      contract={myContract}
      deps={[roomId]}
      url={`wss://example.com/ws/${roomId}`}
    >
      <Child />
    </SockaSessionProvider>
  );
}

function Child() {
  const { ready, send } = useSockaSessionContext(myContract);
  // ...
}
```

Use the **same `contract` reference** on the provider and in **`useSockaSessionContext`** (checked at runtime).

## Deferred WebSocket connect

Use **`autoConnect: false`** on **`SockaWebSocketClient`** / **`SockaSession`** when you want to open the socket later (e.g. after user action). Call **`await session.connect()`** or **`await client.connect()`** before calls; each **`send`** call also awaits connect when the socket is not open yet.

## Client lifecycle

Treat each **`SockaSession`** / **`SockaWebSocketClient`** as bound to **one** underlying **`WebSocket`**. When the socket closes, pending calls reject and should not be retried on the same instance. For reconnect or room changes, construct a **new** client (in React, remount **`useSockaSession`** / **`SockaSessionProvider`** when **`url`** or identity **`deps`** change). Use **`ready`** / **`waitForOpen()`** before assuming the connection is usable; use **`onClose`** / **`onError`** (or **`reportError`**) for backoff, toasts, or logging.

## Pushes

Server push and client subscriptions are covered in [Pushes](./events.md).
