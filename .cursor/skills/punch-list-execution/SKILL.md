---
name: punch-list-execution
description: Read when implementing multi-phase work after a plan exists. Mandatory—create/open/seed temp punch list, one item at a time, per-phase tests. Complements punch-list-planning for authors.
---

# Punch-List Execution (for implementing agents)

## When to read this (mandatory)

**Read this file at the start of implementation** (same session, use the Read tool)—when you are about to **write or change code** under a **multi-phase** or **multi-package** plan.

- If you **authored** the plan, you still follow this skill for the implementation phase.
- If a **planner** handed you a plan, they should have told you to read this skill—**do it before the first code change**.

**Planning** (what to put in the plan document) lives in **[punch-list-planning](../punch-list-planning/SKILL.md)** (repo: `.cursor/skills/punch-list-planning/SKILL.md`). This file is **only** execution discipline.

## Step 1 — Build and own the punch list (first implementation action)

**Your first implementation action** is not “start coding the feature”—it is **punch list I/O**:

1. Ensure the directory exists: `$TMPDIR/router-toolkit-punchlists/` (Linux: `/tmp/router-toolkit-punchlists/`).
2. **Create or open** `<task-slug>.md` for this task (reuse if it already exists from an earlier session).
3. **Seed** the file with phased headings (`## Phase 1: …`) and `- [ ]` items that mirror the **written plan** (and tests/typecheck per phase). If the plan is thin, expand it into **atomic** checklist items here—this file becomes authoritative.
4. Only after the list exists and reflects the work: start the **re-read → first unchecked → execute → mark `[x]`** loop.

**Never** commit punch-list files to the repository.

## Cursor todos vs this checklist

- **Temp punch list** = **source of truth** for what to do next and when phases complete (including test runs).
- **Cursor todos** (if present) = optional **milestone** visibility. You may mark a Cursor todo when the **matching punch-list phase** is done, but **do not** skip creating/updating the temp file or **do not** close out work on Cursor todos alone while punch-list items remain unchecked.

If instructions conflict, prefer: **temp punch list + this skill** over ad-hoc todo ordering.

## Execution loop

1. **Re-read** the punch-list file.
2. Take the **first unchecked** `- [ ]` item.
3. **Execute** it (one primary item in flight).
4. Mark it **`[x]` immediately** with a **one-line note** (what changed or command summary). Do not batch marks at the end.
5. Repeat until the file is complete.

## Phases

- Group items under **phase headings**. Within each phase, order so **implement → tests → run tests/typecheck** appears in the list, then phase wrap-up.
- Mark a **phase** complete **only after** that phase’s test run item is checked and passing.
- Do not mark all phases in one shot at the very end of the project; complete phases incrementally.

## Per-phase testing (required)

- Each phase that changes behavior should include checklist items to **add/update tests** and **run** the narrowest validating command (`bun test …`, `bun run typecheck` in the right package).
- **Run before leaving the phase.**

## Blockers

- Note blockers under the item. Move to the next item only if it is **independent** and policy allows; otherwise stop and surface the blocker.

## End of task

- Re-read the punch list; confirm all items and phases are done; note any known follow-ups explicitly.

## Format hints

- Short concrete items: `- [ ] …`
- Optional: `- [ ] Phase N complete` checked only after that phase’s test run passes.

## Example

```markdown
# Feature X punch list

Re-read → first unchecked → execute → mark [x] with one-line note → repeat.

## Phase 1: Protocol

- [ ] Add protocol types and Zod schemas
- [ ] Add protocol unit tests
- [ ] Run `bun test packages/foo/src/sync-protocol.test.ts`
- [ ] Run `bun run typecheck` in `packages/foo`
- [x] Phase 1 complete — tests green

## Phase 2: Bridge

- [ ] Implement dispatch
- [ ] Add bridge tests
- [ ] Run `bun test packages/foo/src/bridge.test.ts`
```
