---
"@firtoz/collection-sync": minor
---

Add explicit `mode` (`snapshot` | `delta`) to `syncBackfill` server messages. The server declares whether backfill replaces local state or applies incremental deltas; clients apply truncate-then-refill only for snapshots. Fixes stale rows after refresh when the server sent an empty snapshot.

When `syncStateKey` is used with storage, `persistLastAckedServerVersion` now defaults to `true` so reconnect sends the last acked server version (delta backfill) instead of always `0` (full snapshot). Initial sync no longer overwrites stored `lastAckedServerVersion` with `0` when that opt-out is disabled.
