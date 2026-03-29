---
name: punch-list-planning
description: Read when authoring implementation plans, phased roadmaps, or CreatePlan output for multi-step code work. Ensures the plan hands off a mandatory temp punch list and tells the executor which skill to follow.
---

# Punch-List Planning (for plan authors)

## When to read this

- You are writing or updating an **implementation plan** (`.cursor/plans/*.md`, CreatePlan, long numbered checklist) that will be **executed** in a follow-up (same or later agent turn).
- The work is **multi-phase**, spans **multiple packages/files**, or requires **per-phase tests**.

Read **this file** while planning. The **implementing agent** must read **[punch-list-execution](../punch-list-execution/SKILL.md)** when it starts coding—your plan must say so explicitly.

## Mandatory content in every implementation plan

### 1. Execution handoff (non-negotiable)

Include an **Execution** or **Execution discipline** section. **Item 1** under that section must state all of the following in substance (copy or paraphrase):

1. **Executor must read the execution skill** before the first implementation action:  
   `.cursor/skills/punch-list-execution/SKILL.md`
2. **Executor must create the punch list file** (not only “follow the plan” in chat): create or open  
   `$TMPDIR/router-toolkit-punchlists/<task-slug>.md`  
   (Linux: `/tmp/router-toolkit-punchlists/<task-slug>.md`), **seed** it with phased `- [ ]` items derived from **this plan**, then treat **only that file** as the authoritative checklist during implementation: re-read → first unchecked → do → mark `[x]` with a one-line note → repeat.
3. **Do not commit** punch-list files to the repo.

The planner may **outline** phases in prose; the **executor** is responsible for **materializing** the checklist in the temp file as the first implementation step (unless a prior run already created it—in which case open, reconcile with the plan, then continue). Executors follow **[punch-list-execution](../punch-list-execution/SKILL.md)** for **how** to do that: `mkdir -p` + `touch` (or open existing), then **Write** / **StrReplace** for content—**not** shell heredocs (`cat <<'EOF'`). They also **re-edit the punch list at every phase boundary** (mark completion, add next phase items, note discoveries), not only once at startup and once at the end.

### 2. Cursor todos vs temp punch list

If the workflow also uses **Cursor’s todo list** (`todo_write` / IDE todos):

- **Temp punch list** = **authoritative** for order of operations, atomic steps, and **per-phase test runs**.
- **Cursor todos** = optional **high-level** tracking for the user (milestones). They **do not replace** the temp file. The executor should **not** treat “all Cursor todos checked” as done unless the punch list phases (including tests) are complete. It is fine to update Cursor todos when a **phase** on the punch list completes, not instead of maintaining the punch list.

State this distinction in the plan when todos are likely to appear (e.g. “User may have pre-created todos; still create/open the temp punch list and use it for execution.”).

### 3. Per-phase verification

Each phase in the plan must end with **tests + run** (narrowest `bun test` / `typecheck`), not a single testing phase at the end. Name concrete commands where helpful.

### 4. Reference both skills in the plan body

Link or cite:

- **Planning (this doc):** `.cursor/skills/punch-list-planning/SKILL.md`
- **Execution (executor):** `.cursor/skills/punch-list-execution/SKILL.md` (executor reads this before first code change)

## What planners must not do

- Assume the executor will “remember” punch-list rules without reading the execution skill.
- Rely on plan prose or Cursor todos alone as the only checklist once implementation starts.
- Omit **Step 1** that names **file creation + seeding** in temp dir and the **execution skill path**.
