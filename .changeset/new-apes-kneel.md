---
"@firtoz/hono-fetcher": patch
---

Fix `RequestInit` merging: spreading `init` after computed `headers` no longer replaces merged headers (including `Content-Type` for JSON bodies) or overrides method/body. Custom `init.headers` are merged with library defaults.
