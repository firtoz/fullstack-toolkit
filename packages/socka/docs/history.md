# History (pagination, retention, invalidation)

Long-lived rooms often keep a **message log** on the server. Patterns that work well with socka:

## Pagination / cursor

Expose an RPC such as **`listHistory({ limit?, before? })`** where **`before`** is an opaque cursor (e.g. oldest **`ts`** or **`id`** already shown). Return **`messages`** newest-first or oldest-first consistently, and document which end **`before`** anchors.

Clients load an initial page after connect, then **prepend** older pages when the user scrolls up.

## Retention

Enforce **max rows per room** or **time-based pruning** in the handler that **writes** history (e.g. after **`sendMessage`**). Truncation stays a **server policy**; clients learn about bulk wipes via a **push**.

## `historyCleared` (or equivalent)

When one client clears history for everyone, **mutate storage** then **`broadcastPush("historyCleared", { ts, … })`**. Other clients should **drop local message lists** (or refetch **`listHistory`**) so UIs stay consistent.

## Reconnect

After a reconnect, **re-run** **`listHistory`** (or your snapshot RPC) — see **[Reconnection](./reconnection.md)**.

## See also

- **[Getting started](./getting-started.md)** — chat flow.
- **[Pushes](./pushes.md)** — broadcasting invalidation events.
