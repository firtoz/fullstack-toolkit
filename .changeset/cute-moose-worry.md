---
"@firtoz/worker-helper": patch
---

`prepareEnvFiles` no longer copies `.env.example` / `.env.local.example` to real env files when `CI` or `GITHUB_ACTIONS` is set, so CI typegen does not create or rely on generated `.env` files.
