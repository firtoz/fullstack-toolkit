---
"@firtoz/db-helpers": minor
---

Add keyval collection (`keyvalCollectionOptions`, `createKeyValCollection`) backed by a simple `KeyValAdapter` (get/set/del/entries/clear) interface, compatible with localforage and idb-keyval. Uses StandardSchemaV1 for schema definition instead of Drizzle tables.

Also exports generic sync infrastructure (`GenericSyncBackend`, `createGenericSyncFunction`, `createGenericCollectionConfig`) and IR expression evaluator (`evaluateExpression`, `getExpressionValue`) that were previously Drizzle-only or embedded in drizzle-indexeddb.
