# Client

## Vanilla (`SockaSession`)

Outside React, construct **`SockaSession`** from **`@firtoz/socka/client`** with the same **`contract`** as the server and a **`url`** (or a prebuilt **`webSocket`**). **`wireFormat`** defaults to **`"json"`** and must match every server session that receives this connection.

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

**Call names** — For literal `calls` objects, **`defineSocka`** rejects names that would make **`session.send`** Promise-like or clash with object shape (e.g. **`then`**, **`toString`**). If you use a wide **`Record<string, SockaProcedureDef>`**, TypeScript cannot apply that check; **`SockaSession`** still validates at construction (see **`RESERVED_SOCKA_PROCEDURE_NAMES`** in **`@firtoz/socka/core`**).

```ts
import { SockaSession } from "@firtoz/socka/client";
import { myContract } from "./contract";

const session = new SockaSession({ contract: myContract, url: "wss://example.com/ws" });
const rows = await session.send.list();
```

Use **`SockaWebSocketClient`** directly if you need **`onResponse` / `onServerError` / `onEvent`** frame hooks without **`SockaSession`**’s typed **`send`** / **`subscribe`**; most apps use **`SockaSession`**.

**Connection status** — **`SockaWebSocketClient`** and **`SockaSession`** expose **`status`** (`"idle" | "connecting" | "open" | "reconnecting" | "closed"`) and **`onStatusChange`** for UI (e.g. “Reconnecting…”). Same fields power the React hooks below.

## React

### `useSockaSession` — typed `send`

Use **`useSockaSession(contract, options, deps)`** when you want **`send.*`** RPC methods directly (same shape as **`session.send`**). **`ready`** flips to **`true`** after the socket opens; **`deps`** remount the connection when identity (e.g. room id) changes. Also returns **`status`**, **`reconnecting`**, and **`reconnectAttempt`** (see **`useSocka`**).

```ts
import { useSockaSession } from "@firtoz/socka/react";
import { myContract } from "./contract";

function App() {
  const { ready, send } = useSockaSession(myContract, { url: "ws://..." }, []);
  // After `ready`, call `send.list()` / `send.insert(...)` from effects or event handlers (not during render).
  return null;
}

// Binary frames — set the same `wireFormat` on the server session
useSockaSession(myContract, { url: "wss://...", wireFormat: "msgpack" }, []);
```

### `useSocka` — hold a `SockaSession` ref

Use **`useSocka(options, deps)`** when you need the full **`SockaSession`** (e.g. **`session.subscribe`**, **`session.client`**, **`waitForPush`**, or passing the session into non-React helpers). It returns **`{ ready, sessionRef, status, reconnecting, reconnectAttempt }`** — read **`sessionRef.current`** in effects or callbacks (it is **`null`** until the effect runs). Use **`reconnecting`** or **`status === "reconnecting"`** for banners; **`reconnectAttempt`** counts backoff attempts.

| | **`useSockaSession`** | **`useSocka`** |
|--|------------------------|----------------|
| **Returns** | **`{ ready, send, status, reconnecting, reconnectAttempt }`** | **`{ ready, sessionRef, status, reconnecting, reconnectAttempt }`** |
| **Best for** | Most React UIs that only call RPCs | Subscriptions, low-level client access, imperative APIs |

```tsx
import { useEffect } from "react";
import { useSocka } from "@firtoz/socka/react";
import { myContract } from "./contract";

function App() {
  const { ready, sessionRef } = useSocka({ contract: myContract, url: "ws://..." }, []);

  useEffect(() => {
    const s = sessionRef.current;
    if (!ready || !s) return;
    const onNotify = (p: { msg: string }) => console.log(p.msg);
    s.subscribe.on("notify", onNotify);
    return () => s.subscribe.off("notify", onNotify);
  }, [ready, sessionRef]);

  return null;
}
```

*(Example assumes your contract defines a **`notify`** push; use the real push names from **`myContract`**.)*

### `useSockaPresence` — snapshot + join/leave deltas

Call **`useSockaPresence(sessionRef, ready, options, deps)`** after **`useSocka`** / **`useSockaSession`**: it runs your **`snapshot`** RPC once, subscribes to **`joinPush`** / **`leavePush`**, and returns **`{ users, selfUserId, loading }`**. Pass the same **`deps`** as the connection when room identity changes.

### One WebSocket for the whole tree

If many components need **`send`**, avoid calling **`useSockaSession`** in each one (each call owns a connection). Mount a provider once and read the session from context:

```tsx
import { SockaSessionProvider, useSockaSessionContext } from "@firtoz/socka/react";
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
  const { ready, send, status, reconnecting } = useSockaSessionContext(myContract);
  // ...
}
```

Use the **same `contract` reference** on the provider and in **`useSockaSessionContext`** (checked at runtime).

## Deferred WebSocket connect

Use **`autoConnect: false`** on **`SockaWebSocketClient`** / **`SockaSession`** when you want to open the socket later (e.g. after user action). Call **`await session.connect()`** or **`await client.connect()`** before calls; each **`send`** call also awaits connect when the socket is not open yet.

## Client lifecycle

Treat each **`SockaSession`** / **`SockaWebSocketClient`** as bound to **one** underlying **`WebSocket`**. When the socket closes, pending calls reject on that instance unless you opt into client-side reconnect (see **[Reconnection](./reconnection.md)**). For a deliberate room/url change, construct a **new** client (in React, remount **`useSockaSession`** / **`SockaSessionProvider`** when **`url`** or identity **`deps`** change). Use **`ready`** / **`waitForOpen()`** before assuming the connection is usable; use **`onClose`** / **`onError`** (or **`reportError`**) for telemetry.

## Pushes

Server push and client subscriptions are covered in **[Pushes](./pushes.md)**.
