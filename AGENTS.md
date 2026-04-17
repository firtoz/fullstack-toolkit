# Package boundaries

**Do not re-export symbols from other packages.** Each package should export only what it defines. Consumers that need types or functions from package A should import from A directly, not via package B. This keeps dependency graphs clear and avoids transitive API surface.

**Refactoring:** That rule is about **cross-package** API surface (B acting as a passthrough for A). It does **not** mean “never move code.” When you extract symbols into a new module or package, **update importers** to import from the new location.

**Anti-pattern:** Moving implementation out of `SomeComponent` but keeping `export { Thing } from "./newPlace"` (or similar) on `SomeComponent` **only** so existing files can keep importing from `SomeComponent`—that keeps the old module as an unnecessary facade. Prefer updating import paths to the real owner.

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

# JSDoc and public API comments

When editing TypeScript, **preserve** existing **`/** … */`** (JSDoc / TSDoc) on **exported** types, functions, classes, and meaningful public fields **unless** the symbol is deleted or the user explicitly asked to remove or rewrite the docs.

**Do not** drop or trim comment blocks as collateral damage from a “minimal” diff. Refactors and small patches should keep the same level of documentation unless you are deliberately consolidating or fixing accuracy.

If behavior or types change, **update** the JSDoc so it stays true; avoid deleting comments instead of revising them.

**Why:** Hover text and doc tooling surface these blocks; removing them reads like an intentional API documentation regression.

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

**Execution:** Follow [punch-list-execution](.cursor/skills/punch-list-execution/SKILL.md): temp directory only (never commit punch lists); one unchecked item in flight at a time; mark each **phase** complete only after that phase’s test run passes. Create the file with `mkdir -p` + `touch` (or open existing), seed and edit with **Write** / **StrReplace**—not shell heredocs; **update the punch list again at every phase boundary** (completion marks, next-phase items, discoveries), not only at the end.

---

# Cursor Cloud Agents

Repo-level environment config lives in [`.cursor/environment.json`](.cursor/environment.json) (see [Cursor Cloud Agent setup](https://cursor.com/docs/cloud-agent/setup)). It runs `TURBO_TELEMETRY_DISABLED=1 bun install` on VM startup so installs match CI and local workflows.

## Secrets (dashboard)

Configure variables in the Cursor dashboard **Cloud Agents** / **Secrets** (encrypted at rest; exposed as environment variables in the cloud VM). Do **not** rely on committed `.env.local` files for cloud runs.

For parity with [`.github/workflows/pr-checks.yml`](.github/workflows/pr-checks.yml) non-Playwright tests, add the same names your CI uses when those tests are needed:

- `OPENROUTER_API_KEY` (optional for tests that call OpenRouter)
- `CLOUDFLARE_ACCOUNT_ID` (optional)
- `AI_GATEWAY_NAME` (optional)
- `AI_GATEWAY_TOKEN` (optional)

Only add secrets you are willing to grant to cloud agents. If a test is skipped without them, prefer narrowing `bun test` scope to packages that do not require them.

## Cursor Cloud specific instructions

- **Install:** Already handled by `.cursor/environment.json`. If `bun` is missing on the VM, add a `.cursor/Dockerfile` (Debian/Ubuntu) that installs Bun and reference it from `environment.json` per [manual setup](https://cursor.com/docs/cloud-agent/setup).
- **Verification:** Prefer `bun run typecheck`, `bun run lint`, then targeted `bun test` (single package or file) over the full monorepo test matrix.
- **Memory:** Cloud VMs are limited. For broad test runs, use low Turbo concurrency (e.g. `bun turbo run test --concurrency=1` or similar), matching the spirit of CI which avoids parallel overload that can OOM (~7GB on `ubuntu-latest`).
- **Playwright / browser E2E:** GitHub Actions runs E2E for **`test-playground-collections`** and **`test-playground-router`** (sharded) in a **Playwright Docker image** with browser deps preinstalled. Cursor Cloud Agents do not automatically replicate that; full Playwright E2E may require extra system deps or a custom Dockerfile—treat full E2E as optional in cloud unless you have explicitly set that up.

---

# Changeset Generation Guide

**Always add or update a changeset when you change a published package.** Any change to a package that is published (has `publishConfig` or is released) must be reflected in a changeset so the next release has an accurate changelog and version bump. Do not add changesets for internal or unpublished packages (e.g. test apps, e2e, or workspace-only tooling).

## Changelog and `package.json` version (do not edit by hand)

**Never** manually edit a published package’s **`CHANGELOG.md`** or its **`package.json` `version`** field. Release automation (**Changesets**: `changeset version`, publish, etc.) applies version bumps and writes changelog entries from **`.changeset/*.md`**. Agents should record what shipped **only** by adding or editing changeset files under **`.changeset/`**, not by prepending changelog sections or bumping versions.

This supplements the rest of this guide (**Creating Changesets**, **Format**, **Version Bump Guidelines**, **Examples**); it does not replace those steps when a published package changes.

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
