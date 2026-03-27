---
"@firtoz/collection-sync": minor
"@firtoz/drizzle-durable-sqlite": minor
---

Add cursor-based partial sync building blocks with chunked range query protocol, partial client/server bridges, cache management hooks, and a dedicated partial sync transport connector.

Introduce `QueryableDurableObject` for server-authoritative durable SQLite datasets that stream queried ranges without loading full-table snapshots into memory.
