---
"@firtoz/collection-sync": minor
"@firtoz/drizzle-durable-sqlite": minor
---

**@firtoz/collection-sync**

- Predicate `rangeQuery` replaces prior viewport interest (no monotonic accumulation).
- `rangeDelta` is filtered by the requested predicate range; `rowMatchesClientInterest` uses predicate groups only when present so sort-chunk metadata does not widen visibility.
- `rangePatch` delete fan-out is scoped to `deliveredRowIds`; optional `resolveClientVisibility` on `PartialSyncServerBridge`; `removeClient` and `setClientVisibility` helpers.
- `connectPartialSync` registers `visibilitychange` via `globalThis.document` typing so dependents typecheck without the DOM `lib` (e.g. Worker-only projects).

**@firtoz/drizzle-durable-sqlite**

- `createDrizzlePartialSyncStore` `changesSince` filters changelog rows by the client `SyncRange` (predicate and index windows); delete changelog rows store the deleted row snapshot for filtering.
- `QueryableDurableObject` accepts `resolveClientVisibility` and drops partial-sync client state on WebSocket close.
