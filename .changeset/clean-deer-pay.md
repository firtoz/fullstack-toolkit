---
"@firtoz/chat-agent": minor
"@firtoz/chat-agent-drizzle": minor
"@firtoz/chat-agent-sql": minor
"@firtoz/collection-sync": minor
"@firtoz/db-helpers": minor
"@firtoz/drizzle-durable-sqlite": minor
"@firtoz/drizzle-indexeddb": minor
"@firtoz/drizzle-sqlite-wasm": minor
"@firtoz/drizzle-utils": minor
"@firtoz/hono-fetcher": minor
"@firtoz/idb-collections": minor
"@firtoz/maybe-error": minor
"@firtoz/router-toolkit": minor
"@firtoz/socka": minor
"@firtoz/websocket-do": minor
"@firtoz/worker-helper": minor
---

Publish compiled ESM and TypeScript declarations from `dist/` for each package (`tsup`, `prepack` build). `exports`, `main`, and `types` resolve to `dist/`; CLI bins point at built JS with a Node shebang where applicable. Shared `scripts/tsup-lib.ts` discovers `src` entries and externals; workspace test apps map `@firtoz/*` to package sources in `tsconfig` for accurate generics during typecheck. `@firtoz/socka` is published under the scoped name with the same `dist/` layout.
