# Changesets (this repo)

[Changesets](https://github.com/changesets/changesets) records **what** should ship and **how** semver should move. It does **not** require you to edit `package.json` versions by hand.

## Day to day

1. Change code in a **published** package (anything with `publishConfig` / that gets released).
2. Add a changeset file under **this folder**:
   - `bun changeset --empty` then edit the new `.md`, **or**
   - `bun changeset` for the interactive wizard.
3. Commit the **`.changeset/<name>.md`** file with your PR.  
   **Do not** bump `"version"` in `package.json` yourself—that duplicates what the tooling does next.

## Version bump + changelogs

**You do not need to run `bun changeset version` yourself.** Our **CD workflows** consume the pending `.md` files here, bump package **versions**, update **CHANGELOG.md** entries, and refresh dependent workspace ranges—typically via a “Version Packages” style PR or release branch (same as running `changeset version` locally).

Maintainers may still run `bun changeset version` locally when debugging or if automation is off, but day-to-day contributors only add changesets and merge; versioning is automatic from CI/CD.

Upstream reference: [adding changesets](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md), [versioning](https://github.com/changesets/changesets/blob/main/docs/versioning-apps.md).

## File format

```md
---
"@firtoz/package-name": patch
---

Short user-facing summary (shows up in the package changelog).
```

Use `patch` / `minor` / `major` per semver. More detail and examples: **[`AGENTS.md`](../AGENTS.md)** (Changeset Generation Guide).

## When **not** to add a changeset

Skip changesets for **unpublished** apps (e2e fixtures, internal tests, workspace-only tooling) unless you intentionally version them.

## More reading

- [Common questions](https://github.com/changesets/changesets/blob/main/docs/common-questions.md) (official)
- Monorepo root **[`CONTRIBUTING.md`](../CONTRIBUTING.md)** (release flow overview)
