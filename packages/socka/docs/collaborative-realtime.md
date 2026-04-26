# Collaborative realtime (canvas / whiteboard)

Chat examples cover **room messages** and **history** well. A **shared canvas** often adds different concerns:

- **Durable, committed** operations (authoritative state, sequence numbers).
- **Transient** live updates (in-progress strokes, cursors) that should not bloat the document history.
- **High-frequency** pointer data, often **batched** and pushed to peers.

The pattern below is **contract shape only**—it is not a full app. It mirrors how you might name **RPCs** and **pushes** for Driftboard-style flows. For end-to-end wiring, see **[React + Durable Objects](./react-durable-objects.md)**, **[Multi-room](./multi-room.md)**, and the runnable **[chatroom-do](../../examples/chatroom-do)** example.

## Example contract (sketch)

```ts
import { defineSocka } from "@firtoz/socka/core";
import { z } from "zod";

// Replace with your real Standard Schema–compatible shapes
const opSchema = z.object({ type: z.string() });
const shapeSchema = z.object({ id: z.string() });
const cursorInputSchema = z.object({
  x: z.number(),
  y: z.number(),
  pressure: z.number().optional(),
});
const cursorSchema = z.object({ userId: z.string() }).and(cursorInputSchema);

export const boardContract = defineSocka({
  calls: {
    // Request/response: commit an operation and return monotonic `seq`
    applyOp: {
      input: z.object({ op: opSchema }),
      output: z.object({ seq: z.number() }),
    },
    // Fire-and-forget: transient draft; omit `output` (no useless `{ ok: true }` at high rate)
    sendDraft: {
      input: z.object({ shape: shapeSchema.nullable() }),
    },
    sendCursor: {
      input: cursorInputSchema,
    },
  },
  pushes: {
    opApplied: z.object({ op: opSchema, seq: z.number() }),
    draftUpdated: z.object({
      userId: z.string(),
      shape: shapeSchema.nullable(),
    }),
    cursorBatch: z.object({ cursors: z.array(cursorSchema) }),
  },
});
```

**High-frequency cursors and drafts** — **omit** `output` on **`sendCursor`** and **`sendDraft`** so the client’s **`send`** does not wait for a **`serverResponse`**. If you need an **ack** for a one-off action, use **`output: z.void()`** or a real **`output` schema** instead. See **[Client — Fire-and-forget](./client.md#fire-and-forget)** and **[Fire-and-forget observability](./client.md#fire-and-forget-observability)**.

**Optional fields in hand-written types** — If you define **`Point`** next to the schema and use **`exactOptionalPropertyTypes`**, keep optional fields consistent with the inferred zod type (e.g. **`pressure?: number | undefined`**) or use **`z.infer<typeof cursorInputSchema>`**—see **[TypeScript and exact optional properties](./reference.md#typescript-and-exact-optional-properties)**.

## See also

- **[Pushes](./pushes.md)** — `broadcastPush`, `pushHandlers` typing
- **[Durable Objects](./durable-objects.md)** — one DO instance per room, `sessions` map
- **[Backpressure](./backpressure.md)** — when updates flood the connection
