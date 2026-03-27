---
name: punch-list-execution
description: Drive multi-step implementation with a persistent checklist file that the agent re-reads and updates after each completed step. Use when tasks are long, multi-phase, or easy to lose track of.
---

# Punch-List Execution

## When to Use

Use this skill when:

- The task spans many files/packages
- Work has multiple ordered phases
- The agent might lose track of completed vs pending steps
- The user asks for strict execution discipline

## Instructions

1. Create the punch-list in the OS temp directory, not in the repo.
   - Preferred path format: `$TMPDIR/router-toolkit-punchlists/<task-slug>.md`
   - Linux fallback: `/tmp/router-toolkit-punchlists/<task-slug>.md`
   - Reuse the same file for the current task if it already exists.
2. Write an ordered checklist of atomic steps grouped by phase.
3. Include this loop at the top of the file:
   - Read punch list
   - Find first unchecked item
   - Execute it
   - Mark it complete with a one-line note
   - Repeat
4. During implementation:
   - Re-read the punch list before starting each new item
   - Update status immediately after each completed item
   - Keep at most one active item at a time
5. If blocked:
   - Add a short blocker note under the item
   - Move to the next safe, independent item only if allowed
6. At the end:
   - Re-read entire punch list
   - Confirm all required items are complete
   - Record any known residual issue explicitly

## Format Guidelines

- Prefer short, concrete checklist items (`- [ ] ...`)
- Keep each item scoped to one logical action
- Include verification commands as checklist items
- Avoid vague items like "finish implementation"
- Do not place punch-list files inside the repository

## Example

```markdown
# Feature X Punch List

## Phase 1: Protocol and Server

- [ ] Add protocol types and schemas
- [ ] Implement server bridge handling
- [ ] Add server-side unit tests
- [ ] Run package typecheck

## Phase 2: Client and Verification

- [ ] Implement client bridge handling
- [ ] Add client-side unit tests
- [ ] Run focused test suite
- [ ] Run full workspace checks

...
```
