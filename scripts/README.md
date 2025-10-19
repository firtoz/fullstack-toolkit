# Catalog Management Scripts

These scripts manage the automatic resolution of Bun's `catalog:` references for publishing.

## Problem

Bun's workspace catalog feature (`catalog:`) is great for managing shared dependency versions across packages, but Changesets (our publishing tool) doesn't understand it. If we publish with `catalog:` references in `peerDependencies`, `dependencies`, or `optionalDependencies`, they'll appear as literal `"catalog:"` strings in the published npm package.

## Solution

We use scripts that run automatically during the publish workflow:

### `release.ts`

The main release script that orchestrates the entire publish workflow with proper cleanup.

**When it runs:** When you run `bun run release` (usually in CI)

**What it does:**
1. Resolves catalog references (calls `resolve-catalog.ts`)
2. Publishes packages with `changeset publish`
3. **Always** restores catalog references (calls `restore-catalog.ts`), even if publish fails
4. Uses TypeScript `try/finally` to ensure cleanup happens no matter what

### `resolve-catalog.ts`

Replaces all `catalog:` references with actual version numbers from the root `package.json` catalog.

**What it does:**
- Reads the catalog from root `package.json`
- Scans all `packages/*/package.json` files
- Replaces `"catalog:"` with actual versions (e.g., `"catalog:"` → `"^4.1.12"`)
- Works on all dependency types: `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`

### `restore-catalog.ts`

Restores `catalog:` references after publishing using git.

**What it does:**
- Uses `git restore packages/*/package.json` to revert files to their committed state
- Much simpler and more reliable than parsing/rewriting JSON
- Keeps your git history clean - no resolved version commits

## Workflow

```bash
# 1. Make changes, create a changeset
bun run changeset

# 2. When ready to version (usually via PR)
bun run version
# ↳ Runs: changeset version
# ↳ Updates versions in package.json (keeps catalog: references)
# ↳ Commit these changes

# 3. Publish to npm (usually in CI)
bun run release
# ↳ Runs release.ts which:
#    1. Resolves catalog references to real versions
#    2. Publishes packages with changeset publish
#    3. Restores catalog references (even if publish fails!)
# ↳ Your repo stays clean with catalog: references

# Manual usage (if needed)
bun run resolve-catalog  # Resolve catalog references now
bun run restore-catalog  # Restore catalog references now
```

## Benefits

✅ **Single source of truth** - All shared dependency versions in one place  
✅ **Type-safe** - Bun validates catalog references during development  
✅ **Clean git history** - No need to update versions in multiple files  
✅ **Proper npm packages** - Published packages have real version numbers  
✅ **Automatic** - Scripts run as part of your existing workflow  

## Catalog in Root package.json

The catalog is defined in the root `package.json`:

```json
{
  "catalog": {
    "bun-types": "^1.3.0",
    "typescript": "^5.9.3",
    "hono": "^4.10.1",
    "react": "^19.2.0",
    "zod": "^4.1.12"
    // ...
  }
}
```

Any package can then reference these with `"catalog:"`:

```json
{
  "peerDependencies": {
    "hono": "catalog:",
    "zod": "catalog:"
  }
}
```

