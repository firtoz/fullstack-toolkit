# Published package smoke (registry)

Installs `@firtoz/*` from npm and checks load + runtime exports. Split by runtime so each folder matches how the packages are used:

| Folder | Role |
|--------|------|
| [`shared/`](shared/) | Package list, export expectations, groups (`NODE` / Workers / React Router), shared `runSmoke()` |
| [`node-smoke/`](node-smoke/) | **Node** — packages that do not need `cloudflare:*` or a React Router tree |
| [`cf-worker-smoke/`](cf-worker-smoke/) | **Workers** — `@cloudflare/vitest-pool-workers` + minimal `wrangler` worker |
| [`react-router-smoke/`](react-router-smoke/) | **React Router** — Vitest + jsdom, `RouterProvider` + `ConcurrentSubmitterProvider` |

**Network required.** Not part of default CI.

```bash
cd tests/published-smoke/node-smoke && bun install && bun run smoke
cd tests/published-smoke/cf-worker-smoke && bun install && bun run smoke
cd tests/published-smoke/react-router-smoke && bun install && bun run smoke
```

Use `npm install` in those folders if you prefer npm.

From repo root:

```bash
bun run test:published-smoke:node
bun run test:published-smoke:workers
bun run test:published-smoke:react-router
bun run test:published-smoke:all
```
