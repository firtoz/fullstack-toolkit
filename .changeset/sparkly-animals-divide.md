---
"@firtoz/router-toolkit": patch
---

Fix FetcherRunner never settling operations: account for the `loading` (revalidation) phase in the fetcher lifecycle so the idle transition is correctly detected.
