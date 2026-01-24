# Changeset Generation Guide

## Creating Changesets

When the user asks to create a changeset:

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
