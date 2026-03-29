---
"@firtoz/db-helpers": patch
"@firtoz/drizzle-indexeddb": patch
"@firtoz/drizzle-utils": patch
---

Remove the Cursor debug NDJSON `debugSyncLog` helper and all call sites (generic sync, Drizzle IndexedDB collection, SQLite table sync backend).
