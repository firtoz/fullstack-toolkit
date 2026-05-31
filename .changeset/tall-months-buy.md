---
"@firtoz/hono-fetcher": patch
"@firtoz/collection-sync": patch
"@firtoz/db-helpers": patch
"@firtoz/drizzle-durable-sqlite": patch
"@firtoz/drizzle-indexeddb": patch
"@firtoz/drizzle-utils": patch
"@firtoz/idb-collections": patch
---

Align with catalog dependency updates (Hono 4.12, `@hono/zod-validator` 0.8, TanStack DB 0.6.7, React 19.2.6, Valibot 1.4.1).

- **hono-fetcher:** Strip Zod validator 400 JSON bodies from inferred route response types so `json()` matches handler payloads again.
- **Peer ranges:** Widen minimum `@tanstack/db`, `@tanstack/react-db`, `react`, and `valibot` versions to match the workspace catalog.
