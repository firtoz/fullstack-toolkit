# Backpressure

Today, socka does **not** expose explicit **backpressure** or **pause/resume** on **`emitPush`** / **`broadcastPush`**. Delivery follows the underlying **WebSocket** and **TCP** behavior: if a client is slow, **buffers** grow in the runtime/network stack.

## When it matters

- Very **large** or **frequent** pushes (e.g. big blobs, rapid fire).
- Many **slow** subscribers in a room.

## Practical guidance

- **Chunk** large logical messages in **application code** (multiple smaller pushes or an RPC that streams chunks).
- Prefer **smaller push payloads** and **pagination** for history-style data.
- For most apps, **TCP** flow control is enough; if you routinely saturate buffers, measure and consider **rate limits** or **per-client queues** in your domain layer.

Future library work could add explicit flow control; until then, treat **backpressure as an app concern** for extreme cases.
