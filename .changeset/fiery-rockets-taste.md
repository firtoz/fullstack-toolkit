---
"@firtoz/collection-sync": major
"@firtoz/drizzle-durable-sqlite": major
---

Export `PartialSyncRowRef`, `PartialSyncRowVersion`, and `PartialSyncRowShape` from `@firtoz/collection-sync`. Sync and partial-sync bridges, `withSync`, and React partial-sync hooks require `PartialSyncRowShape`: every row must declare an `updatedAt` key (values may be `number`, `Date`, `null`, or `undefined` for “no watermark”). Types without that property are intentionally unsupported for these APIs.

`@firtoz/drizzle-durable-sqlite` session/codec paths align with the same row constraint (`BridgeRow` / `PartialSyncRowShape`).
