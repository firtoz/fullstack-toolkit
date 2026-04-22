---
"@firtoz/drizzle-sqlite-wasm": patch
---

Use `OpfsDb` when the constructor is present instead of `"opfs" in sqlite3`, because sqlite-wasm removes the `opfs` helper namespace after init in non-test builds (which incorrectly forced a transient database). Wire WAL checkpoint through a ref so collections created before the worker client is ready still flush to OPFS after mutations.
