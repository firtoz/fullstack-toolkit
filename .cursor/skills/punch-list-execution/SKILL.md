---
name: punch-list-execution
description: Drive multi-step implementation with a persistent checklist file, per-phase tests and test runs, and incremental phase completion. Use when planning or executing long, multi-phase work.
---

# Punch-List Execution

## When to Use

Use this skill when:

- The task spans many files or packages
- Work has multiple ordered phases
- The agent might lose track of completed vs pending steps
- The user asks for strict execution discipline

**Planning:** When writing or updating a plan for another agent (or future you), mention this skill in the plan’s execution section and require a temp-directory punch list that mirrors the plan’s phases—each phase must include testing and a test run (see below).

**Execution:** Follow this skill for the full loop: punch list → implement → test → mark progress → repeat.

## Planning stage (plan authors)

Plans that imply multi-phase implementation should:

1. Reference this skill explicitly (path: `.cursor/skills/punch-list-execution/SKILL.md`).
2. State that the implementer must create or reuse a punch list under `$TMPDIR/router-toolkit-punchlists/<task-slug>.md` (Linux: `/tmp/router-toolkit-punchlists/<task-slug>.md`), not in the repo.
3. Break work into phases where **each phase ends with verification**: add automated tests scoped to that phase’s behavior, then **run** those tests (or the narrowest command that covers them) before starting the next phase. Avoid deferring all testing to a final “testing” phase—errors compound and rework explodes.
4. Call out which test commands apply after each phase (e.g. `bun test packages/foo`, `bun test path/to/file.test.ts`, package `typecheck`).

## Execution stage (implementing agents)

1. **Create or open** the punch-list file in the OS temp directory (not the repo).
   - Preferred: `$TMPDIR/router-toolkit-punchlists/<task-slug>.md`
   - Linux fallback: `/tmp/router-toolkit-punchlists/<task-slug>.md`
   - Reuse the same file for the current task if it already exists.
2. **Write** an ordered checklist of atomic steps **grouped by phase**. Within each phase, order items so that **tests and a test run come last for that phase** (implement → add/update tests → run tests → then phase wrap-up).
3. **Loop** for each unchecked item:
   - Re-read the punch list
   - Find the first unchecked item
   - Execute it
   - Mark that item `[x]` immediately, with a one-line note (what was done or command output summary)
   - **Do not** defer marking items until “the end”
4. **After every phase** (when all items in that phase are checked):
   - Add or confirm a short **phase completion line** for that phase only (e.g. under the phase heading: `**Phase status:** complete — <date or note>`), or check a dedicated `- [x] Phase N complete` item if you included one in the list
   - **Do not** mark all phases complete in one batch at the end of the whole task; mark each phase as soon as its items (including its tests and test run) are done
5. **Keep at most one active checklist item** in progress at a time (one unchecked item you are working on).
6. **If blocked:** add a short blocker note under the item; only move to the next safe, independent item if the user or constraints allow it.
7. **At the very end of the task:** re-read the punch list, confirm all required items and phases are complete, and record any known residual issues explicitly.

## Per-phase testing (required)

- **Every phase** that changes behavior should include at least:
  - Items to **add or update** automated tests covering that phase (unit, integration, or e2e—whatever fits the smallest useful scope).
  - An item to **run** tests: the narrowest command that validates the phase (package-scoped `bun test`, single test file, etc.). Include **typecheck** for that package when types changed.
- **Run tests before leaving the phase.** Fixing failures in the same phase is cheaper than stacking multiple phases of untested code.
- If a phase is documentation-only or trivial, the checklist can say so and use a minimal verification item (e.g. “N/A — doc-only; run `bun test` on touched package if any code paths changed”).

## Format guidelines

- Prefer short, concrete items: `- [ ] ...`
- Group under clear phase headings (`## Phase 1: ...`).
- Optional but useful: end each phase with `- [ ] Phase N complete` (verification that tests passed and phase goals met)—check it **only after** the phase’s test run item is checked.
- Include **verification commands** as explicit checklist items (tests, typecheck).
- Avoid vague items like “finish implementation” or “do tests at the end.”
- **Never** commit punch-list files to the repository.

## Example

```markdown
# Feature X punch list

Read → first unchecked → execute → mark [x] with one-line note → repeat.
Re-read before each new item. Run this phase’s tests before starting the next phase.

## Phase 1: Protocol

- [ ] Add protocol types and Zod schemas
- [ ] Add protocol unit tests (`sync-protocol.test.ts`)
- [ ] Run `bun test packages/foo/src/sync-protocol.test.ts`
- [ ] Run `bun run typecheck` in `packages/foo`
- [x] Phase 1 complete — schemas + tests green

## Phase 2: Server bridge

- [ ] Implement bridge dispatch for new message type
- [ ] Add bridge tests
- [ ] Run `bun test packages/foo/src/bridge.test.ts`
- [ ] Phase 2 complete — (check after test run passes)

## Phase 3: Client + E2E

- [ ] Implement client handling
- [ ] Add client tests
- [ ] Run client package tests
- [ ] Extend e2e if needed; run `bun run test:e2e` in app (if applicable)
- [ ] Phase 3 complete
```
