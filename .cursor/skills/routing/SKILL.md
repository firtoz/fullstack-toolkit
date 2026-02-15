---
name: routing
description: React Router v7 routing patterns and environment variable configuration. Use when adding routes, configuring routing, or setting up environment variables.
---

# React Router Routes

This project uses React Router v7 with file-based routing configured in `app/routes.ts` (in test-playground: `tests/test-playground/app/routes.ts`).

## ⚠️ CRITICAL: Run Typegen After Editing routes.ts

**WHENEVER you edit `app/routes.ts` (or `tests/test-playground/app/routes.ts`), run typegen:**

```bash
# From repo root for test-playground
cd tests/test-playground
bun run typegen
```

Or use the typecheck script (it runs typegen first): `bun run typecheck`.

**Without this, TypeScript imports can fail.** Typegen generates the `+types` files that route components need.

## Adding a New Route

### 1. Create the Route File

Create the route file under `app/routes/` (or `tests/test-playground/app/routes/`):
- Collections: `routes/collections/`
- API: `routes/api/`
- Router-toolkit: `routes/router-toolkit/`

### 2. Register the Route in routes.ts

```typescript
// Example: collections prefix
...prefix("collections", [
  route("standalone-test", "routes/collections/standalone-test.tsx"),
  route("memory-collection-test", "routes/collections/memory-collection-test.tsx"), // ← New
]),
```

### 3. Run React Router typegen

```bash
cd tests/test-playground  # or the app that contains routes.ts
bun run typegen
```

### 4. Use Generated Types in Route File

After typegen, use the generated types if needed (e.g. `Route.LoaderArgs`, `Route.ActionArgs`).

## Common Mistake

Creating a route file without registering it in `routes.ts` results in a 404. Always register new routes.

## Environment Variables

When adding new environment variables:

1. Add the variable to `.env.example` with documentation
2. Add to `.env` (real or placeholder for local dev)
3. Run typegen if env types are generated from .env
