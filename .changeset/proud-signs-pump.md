---
"@firtoz/router-toolkit": major
"@firtoz/hono-fetcher": patch
"@firtoz/worker-helper": patch
"@firtoz/drizzle-sqlite-wasm": major
"@firtoz/drizzle-durable-sqlite": major
---

**@firtoz/router-toolkit:** Stop re-exporting `@firtoz/maybe-error` from the package entry so `.d.ts` matches runtime. `@firtoz/maybe-error` is now a regular dependency; import `success`, `fail`, `MaybeError`, `exhaustiveGuard`, and related symbols from `@firtoz/maybe-error` directly.

**@firtoz/hono-fetcher** and **@firtoz/worker-helper:** Regenerate root `index.d.ts` after tsup so type-only symbols use `export type { ... }`, for compatibility with stricter consumer compiler settings.

**@firtoz/drizzle-sqlite-wasm:** Remove re-exports of `@firtoz/drizzle-utils` (`syncableTable`, `makeId`, branded/schema types, `SQLOperation`, `SQLInterceptor`) from the package entry. Import those from `@firtoz/drizzle-utils` directly.

**@firtoz/drizzle-durable-sqlite:** Stop re-exporting `SQLOperation` and `SQLInterceptor` from the package entry; import them from `@firtoz/drizzle-utils` when needed.
