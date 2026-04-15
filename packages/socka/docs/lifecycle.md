# Lifecycle

Join, message, and **leave** ordering for socka sessions—whether you use **`@firtoz/socka/server`**, **`@firtoz/socka/bun`**, **`@firtoz/socka/hono`**, or **`@firtoz/socka/do`**.

## Registration and `onAttached`

1. The adapter accepts or upgrades a **`WebSocket`** and constructs a session (**`SockaWebSocketSession`** or **`SockaDoSession`**).
2. The session is **registered** in the shared **`sessions`** map (the map **`broadcastContractEvent`** uses).
3. On the next microtask, **`onAttached`** runs (if you provided it). Other sessions in the map can see this socket—use this for join broadcasts, not the constructor.

If **`onAttached`** throws or returns a rejected promise, the failure is reported via **`reportError`** (or **`console.error`** by default) with kind **`serverOnAttached`**.

## Inbound RPCs

While the socket is open, inbound data is decoded ( **`handleRawMessage`**, **`dispatchSockaInboundMessage`**, or Bun/Hono wrappers), inputs are validated, and **`handlers[procedure]`** runs. Handler exceptions → **`onHandlerError`**; bad wire payloads → **`onValidationError`** before your handler—see **[Reference](./reference.md)**.

## Close and `handleClose`

When the transport closes:

1. The adapter calls **`await session.invokeHandleClose()`**, which runs **your** **`handleClose(session)`**.
2. **Until that finishes, the session remains in **`sessions`**—so peer iteration and **`broadcastContractEvent`** can still see the closing peer (e.g. “last player left”).
3. Then the adapter removes the socket from the map.

**`SockaDoSession`** delegates teardown through **`@firtoz/websocket-do`**; see **[Durable Objects](./durable-objects.md)** for **`BaseSession`** details.

## Hibernation (Durable Objects only)

If you use **`SockaDoSession`**, mutating **`session.data`** may require **`await session.update()`** so hibernation attachments stay consistent. See **[Durable Objects](./durable-objects.md)**.

See also [Multi-room](./multi-room.md).
