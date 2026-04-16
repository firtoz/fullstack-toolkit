---
"@firtoz/worker-helper": patch
---

`prepareEnvFiles` no longer passes `.env` / `.env.local` to `wrangler types` when a matching `.env.example` / `.env.local.example` exists, so generated `worker-configuration.d.ts` headers match CI and local dev.
