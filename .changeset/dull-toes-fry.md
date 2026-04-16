---
"@firtoz/drizzle-utils": patch
"@firtoz/db-helpers": patch
"@firtoz/maybe-error": patch
---

Add `require` and `default` conditions to `package.json` `exports` so CommonJS tools (e.g. drizzle-kit) can resolve these packages under Node.
