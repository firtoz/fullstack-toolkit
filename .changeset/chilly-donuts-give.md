---
"@firtoz/collection-sync": patch
---

Align predicate row refs with TanStack DB 0.6.x: `PredicateRowRef` is now a typed query `Ref` so `inArray`/`orderBy` accept column expressions; `buildRangeConditionsAndExpression` accepts `PredicateRangeBuildRow` (refs or plain objects for tests).
