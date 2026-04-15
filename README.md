# fullstack-toolkit

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh)
[![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?logo=turborepo&logoColor=white)](https://turbo.build)
[![Pull Request Checks](https://github.com/firtoz/fullstack-toolkit/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/firtoz/fullstack-toolkit/actions/workflows/pr-checks.yml)

**Typed building blocks for full-stack TypeScript** — React Router 7, Cloudflare Workers & Durable Objects, TanStack DB with Drizzle in the browser and on the edge, schema-first WebSocket RPC, and small shared utilities. Everything publishes as [`@firtoz/*` on npm](https://www.npmjs.com/search?q=scope%3A%40firtoz).

---

## Packages

Grouped by what you’re building; each name links to the package README.

### React & routing

| Package | What it does |
|--------|----------------|
| [**@firtoz/router-toolkit**](packages/router-toolkit) | Typed fetchers, submitters, and form actions for React Router 7 framework mode. |

### Cloudflare & edge

| Package | What it does |
|--------|----------------|
| [**@firtoz/hono-fetcher**](packages/hono-fetcher) | Infer Hono `AppType` routes and bodies from Workers / DO fetchers. |
| [**@firtoz/websocket-do**](packages/websocket-do) | WebSocket sessions on Durable Objects with Standard Schema messages. |
| [**@firtoz/chat-agent**](packages/chat-agent) | Wire protocol + `ChatAgentBase` for DO chat agents (OpenRouter). |
| [**@firtoz/chat-agent-drizzle**](packages/chat-agent-drizzle) | Drizzle persistence + migrations for chat-agent. |
| [**@firtoz/chat-agent-sql**](packages/chat-agent-sql) | Raw `this.sql` persistence for chat-agent. |
| [**@firtoz/drizzle-durable-sqlite**](packages/drizzle-durable-sqlite) | TanStack DB + Drizzle on Durable Object SQLite. |

### WebSockets & RPC

| Package | What it does |
|--------|----------------|
| [**@firtoz/socka**](packages/socka) | One Standard Schema contract: typed `session.send.*` RPC + optional pushes — [docs hub](packages/socka/docs/README.md). |

### Browser data (TanStack DB · Drizzle)

| Package | What it does |
|--------|----------------|
| [**@firtoz/drizzle-indexeddb**](packages/drizzle-indexeddb) | TanStack DB collections on IndexedDB with Drizzle-shaped migrations. |
| [**@firtoz/drizzle-sqlite-wasm**](packages/drizzle-sqlite-wasm) | SQLite WASM in a worker + TanStack DB collections. |
| [**@firtoz/idb-collections**](packages/idb-collections) | IndexedDB key-value adapter and query helpers for TanStack DB. |
| [**@firtoz/collection-sync**](packages/collection-sync) | WebSocket sync protocol and bridges for collections (see also `@firtoz/websocket-do`). |

### Shared primitives

| Package | What it does |
|--------|----------------|
| [**@firtoz/maybe-error**](packages/maybe-error) | `MaybeError` / `success` / `fail` — typed results without exceptions. |
| [**@firtoz/drizzle-utils**](packages/drizzle-utils) | Syncable tables, branded IDs, helpers shared across Drizzle packages. |
| [**@firtoz/db-helpers**](packages/db-helpers) | TanStack DB helpers (e.g. memory collections for tests). |
| [**@firtoz/worker-helper**](packages/worker-helper) | Typed Web Workers with Zod; includes Cloudflare typegen helpers. |

Several packages are still **early / WIP** — check each README for status and peers.

---

## Installation

Install only what you need; peers vary by package.

```bash
# Examples — see each package README for full peer lists
bun add @firtoz/router-toolkit
bun add @firtoz/maybe-error
bun add @firtoz/hono-fetcher
bun add @firtoz/websocket-do
npm install @firtoz/socka
bun add @firtoz/chat-agent @openrouter/sdk agents
# bun add @firtoz/chat-agent-drizzle drizzle-orm
# bun add @firtoz/chat-agent-sql

bun add @firtoz/drizzle-indexeddb @firtoz/drizzle-utils drizzle-orm @tanstack/db
bun add @firtoz/drizzle-sqlite-wasm @firtoz/drizzle-utils drizzle-orm @tanstack/db
bun add @firtoz/worker-helper zod
```

---

## Development

Uses [Bun](https://bun.sh/), [Turborepo](https://turbo.build/), and [Changesets](https://github.com/changesets/changesets) for releases.

```bash
bun install
bun run typecheck
bun run lint
bun run format
```

Filter a single workspace:

```bash
bun run --filter="@firtoz/router-toolkit" typecheck
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Commits follow [Conventional Commits](https://www.conventionalcommits.org/); use `bun changeset` when you change a published package.

```text
feat(router-toolkit): add hook for …
fix(maybe-error): …
docs: update README
```

---

## Releases

1. Land changes and add a changeset: `bun changeset`
2. Merge to `main`
3. CI opens a **Version Packages** PR; merging it publishes `@firtoz/*` to npm.

---

## License

MIT © [Firtina Ozbalikchi](https://github.com/firtoz)

## Ecosystem docs

- [React Router](https://reactrouter.com) · [Hono](https://hono.dev) · [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects)
- [Drizzle ORM](https://orm.drizzle.team) · [TanStack DB](https://tanstack.com/db) · [Standard Schema](https://standardschema.dev)
