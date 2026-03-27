# Package boundaries

**Do not re-export symbols from other packages.** Each package should export only what it defines. Consumers that need types or functions from package A should import from A directly, not via package B. This keeps dependency graphs clear and avoids transitive API surface.

# Backwards compatibility

**Do not worry about backwards compatibility.** Prefer the right API and design. Use semver correctly: breaking changes get a major bump (or appropriate bump), and the changeset describes the change. No need to preserve old APIs, re-exports, or compatibility layers for existing users.

# Code Style: Discriminated Unions

For **discriminated unions** and enum-like types (e.g. message shapes with a `type` or `kind` field), use a **switch** with **`exhaustiveGuard(value)`** from `@firtoz/maybe-error` in the default branch so new variants cause a compile error:

```ts
import { exhaustiveGuard } from "@firtoz/maybe-error";
switch (msg.type) {
  case "insert": ... break;
  case "update": ... break;
  case "delete": ... break;
  case "truncate": ... break;
  default:
    exhaustiveGuard(msg);
}
```

See [.cursor/skills/exhaustive-switches/SKILL.md](.cursor/skills/exhaustive-switches/SKILL.md) for the full guideline.

---

# Cloudflare / Wrangler Typegen

When working on Cloudflare Workers apps (including test fixtures), **always use the Cloudflare typegen workflow skill**:

- [.cursor/skills/cloudflare-wrangler-typegen/SKILL.md](.cursor/skills/cloudflare-wrangler-typegen/SKILL.md)

Use it whenever you touch:

- `wrangler.jsonc` / `wrangler.app.jsonc`
- Durable Object or service bindings
- Worker entrypoints and `Env`-typed code
- New Workers fixtures/apps

**Never manually create or edit `worker-configuration.d.ts` (or generated worker env `.d.ts`) files.**  
Always regenerate via app scripts (typically `bun run typegen` / `bun run cf-typegen`).

---

# Type Safety: No Escape Hatches

When writing or modifying TypeScript, **always use the strict typing skill**:

- [.cursor/skills/strict-types-no-escape-hatches/SKILL.md](.cursor/skills/strict-types-no-escape-hatches/SKILL.md)

## Mandatory Restrictions

- Never use `any`
- Never use `as any`
- Never use `as never`
- Never use double-casts like `as unknown as T`
- Never use `@ts-ignore` / `@ts-expect-error` to bypass type errors

If typing is difficult, improve the types/interfaces/generics instead of bypassing the compiler.

---

# Execution Discipline: Punch Lists

For large or multi-phase implementation tasks, use:

- [.cursor/skills/punch-list-execution/SKILL.md](.cursor/skills/punch-list-execution/SKILL.md)

This skill enforces a persistent punch-list workflow stored in the OS temp directory (not the repo) so the agent repeatedly:
read -> execute next unchecked item -> mark complete -> continue.

---

# Changeset Generation Guide

**Always add or update a changeset when you change a published package.** Any change to a package that is published (has `publishConfig` or is released) must be reflected in a changeset so the next release has an accurate changelog and version bump. Do not add changesets for internal or unpublished packages (e.g. test apps, e2e, or workspace-only tooling).

## Creating Changesets

When the user asks to create a changeset, or when you make changes to a published package:

1. **Run the changeset command with --empty flag:**
   ```bash
   bun changeset --empty
   ```
   This creates a new changeset file with a random name (e.g., `blue-points-brake.md`)

2. **Edit the generated file** to include:
   - Package name(s) in the frontmatter
   - Version bump type: `patch`, `minor`, or `major`
   - Clear description of the changes

## Format

```md
---
"@firtoz/package-name": minor
---

Brief description of the change from a user perspective.
```

## Version Bump Guidelines

- **patch**: Bug fixes, documentation updates, internal refactors
- **minor**: New features, new exports, backward-compatible changes
- **major**: Breaking changes, API changes that affect existing users

## Examples

### Adding a new feature
```md
---
"@firtoz/worker-helper": minor
---

Export `cf-typegen` as a CLI binary. Users can now run `cf-typegen $(pwd)` directly after installing the package.
```

### Bug fix
```md
---
"@firtoz/websocket-do": patch
---

Fix memory leak in WebSocket connection cleanup.
```

### Multiple packages
```md
---
"@firtoz/worker-helper": minor
"@firtoz/websocket-do": patch
---

Add new utility function to worker-helper and fix bug in websocket-do.
```
