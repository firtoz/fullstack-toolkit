---
"@firtoz/idb-collections": patch
---

`tryExtractIndexedQuery` now resolves indexes when TanStack DB uses nested property refs (e.g. `todo.priority`) by falling back to the last path segment, matching single-column IndexedDB key paths. `extractSimpleComparisons` failures (e.g. `like`) return null without logging an error; optional debug logging uses `console.warn`.
