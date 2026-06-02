---
"@firtoz/hono-fetcher": patch
---

Fix `honoFetcherMounted` root route requests with query strings so mounted roots use `/mount?query=...` instead of `/mount/?query=...`.
