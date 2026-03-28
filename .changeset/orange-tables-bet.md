---
"@firtoz/drizzle-utils": patch
---

`createCollectionConfig` now types `getKey` as returning `IdOf<TTable>` (matching `createGetKeyFunction`) and adapts it for the string-keyed generic sync layer internally.
