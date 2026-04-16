---
"@firtoz/socka": patch
---

Set `ignoreDeprecations` to `6.0` in `tsconfig.json` so the declaration build succeeds on TypeScript 6 (silences TS5101 for deprecated `baseUrl` used by the DTS pipeline).
