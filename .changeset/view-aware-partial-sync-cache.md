---
"@firtoz/collection-sync": minor
---

Partial sync `rangePatch` may include `viewTransition` (`enterView` | `exitView`) so updates that cross the client interest boundary stay as real `update` messages (cache-friendly) instead of fake insert/delete. `PartialSyncClientBridge` applies enter/exit semantics, tracks `serverConfirmedKeys` for `cacheDisplayMode: "confirmed"` on `usePartialSyncViewport`, and supports `onViewTransition` / `onRangePatchApplied`. Predicate filtering uses TanStack `useLiveQuery` with expression `where` clauses. `usePartialSyncWindow` clears stale index-map entries on `exitView` and debounces a forced seek when an in-window row’s sort key changes from a live patch.
