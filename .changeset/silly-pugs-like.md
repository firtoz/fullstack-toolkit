---
"@firtoz/drizzle-sqlite-wasm": patch
---

Fix `compilerOptions.lib` in tsconfig (was at top level instead of inside `compilerOptions`); add `DOM` so `window` resolves during DTS generation.
