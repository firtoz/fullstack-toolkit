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

Two skills—**planning** vs **execution**—so phased work does not collapse into “vibes” or IDE todos alone:

| Role | Skill | When |
|------|--------|------|
| **Plan author** (CreatePlan, `.cursor/plans/`, handoff to another turn) | [.cursor/skills/punch-list-planning/SKILL.md](.cursor/skills/punch-list-planning/SKILL.md) | While writing or updating the implementation plan |
| **Implementing agent** (first line of code onward) | [.cursor/skills/punch-list-execution/SKILL.md](.cursor/skills/punch-list-execution/SKILL.md) | **Before** the first implementation action, every time |

**Planning (before you finalize a plan):**

1. **Read** [punch-list-planning](.cursor/skills/punch-list-planning/SKILL.md) in the same session (do not rely on memory from past chats).
2. Every **implementation plan** must include an **Execution** section whose **first numbered item** tells the **executor** to: **read** [punch-list-execution](.cursor/skills/punch-list-execution/SKILL.md), then **create or open** `$TMPDIR/router-toolkit-punchlists/<task-slug>.md` (Linux: `/tmp/router-toolkit-punchlists/<task-slug>.md`), **seed** it with phased `- [ ]` items derived from the plan, and use **only that file** as the authoritative checklist: re-read → first unchecked → execute → mark `[x]` immediately with a one-line note → repeat. Prose in the plan describes *what*; the temp file is the *order of operations* during implementation.
3. **Executor builds the file:** The planner’s job is to **require** this in writing; the implementing agent’s **first implementation step** is punch-list I/O (create/open/seed), not skipping straight to code.
4. **Cursor todos vs punch list:** If the workflow uses Cursor’s todo list, it is for **optional high-level milestones** only. The **temp punch list** is mandatory for step-by-step execution and **per-phase** test runs. Do not treat “all todos checked” as done unless the punch-list phases (including tests) are complete.
5. Each phase in the plan and on the punch list must end with **tests + a test run** (narrowest `bun test` / `typecheck` as appropriate)—**not** one big testing phase at the end.

**Execution:** Follow [punch-list-execution](.cursor/skills/punch-list-execution/SKILL.md): temp directory only (never commit punch lists); one unchecked item in flight at a time; mark each **phase** complete only after that phase’s test run passes.

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
