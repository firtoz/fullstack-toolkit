# Contributing to Router Toolkit Monorepo

Thank you for your interest in contributing to the Router Toolkit monorepo! This repository contains multiple packages that work together to provide TypeScript utilities for React Router and error handling.

## Packages

- **[@firtoz/router-toolkit](./packages/router-toolkit)** - React Router 7 utilities
- **[@firtoz/maybe-error](./packages/maybe-error)** - Type-safe error handling

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- [Node.js](https://nodejs.org/) (>=18.0.0)

### Getting Started

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```

3. Run type checking:
   ```bash
   bun run typecheck
   ```

4. Run linting:
   ```bash
   bun run lint
   ```

5. Format code:
   ```bash
   bun run format
   ```

### Package-specific Commands

This monorepo uses [Turborepo](https://turbo.build/) for efficient task orchestration. Commands automatically run across all packages with intelligent caching and dependency management.

You can also run commands on individual packages:

```bash
# Run across all packages (using Turborepo - recommended)
bun run typecheck  # Runs typecheck in all packages with caching
bun run lint       # Runs lint in all packages
bun run format     # Runs format in all packages

# Run on specific packages (using Bun workspaces)
bun run --filter="@firtoz/router-toolkit" typecheck
bun run --filter="@firtoz/maybe-error" lint
bun run --filter="@firtoz/router-toolkit" format
```

## Commit Message Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation. All commit messages are validated by commitlint.

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature (triggers minor version bump)
- **fix**: A bug fix (triggers patch version bump)
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scopes

Use the package name as the scope when making changes specific to a package:

- `router-toolkit`: Changes to the router-toolkit package
- `maybe-error`: Changes to the maybe-error package

### Examples

```bash
# New feature in router-toolkit (0.3.0 → 0.4.0)
git commit -m "feat(router-toolkit): add new hook for dynamic routing"

# Bug fix in maybe-error (0.3.0 → 0.3.1)
git commit -m "fix(maybe-error): resolve type inference issue"

# Documentation update
git commit -m "docs: update README with new examples"

# Breaking change (0.3.0 → 1.0.0)
git commit -m "feat(router-toolkit)!: redesign API for better type safety"

# With scope and body
git commit -m "feat(router-toolkit): add useDynamicSubmitter hook

Add new hook for handling dynamic form submissions with automatic
validation and loading states."
```

### Breaking Changes

To indicate a breaking change, add `!` after the type or add `BREAKING CHANGE:` in the footer:

```bash
git commit -m "feat(router-toolkit)!: remove deprecated useLegacyFetch hook"
# or
git commit -m "feat(router-toolkit): update API design

BREAKING CHANGE: useFetch now returns different interface"
```

## Making Changes

### Adding New Features

1. Create a new branch from `main`
2. Make your changes in the appropriate package
3. Add tests if applicable
4. Update documentation
5. Run `bun run typecheck` and `bun run lint` to ensure quality
6. Commit your changes following the conventional commit format
7. Open a pull request

## Release Process

Releases are **fully automated** using [Changesets](https://github.com/changesets/changesets) with GitHub Actions:

### For Contributors

1. **Make your changes** and commit them
2. **Create a changeset** to describe your changes:
   ```bash
   bun changeset
   ```
3. **Follow the prompts** to:
   - Select which packages are affected
   - Choose the type of version bump (patch/minor/major)
   - Write a summary of the changes
4. **Commit the changeset** along with your code changes
5. **Push to main** (or open a pull request and merge it)

### For Maintainers

The process is now **fully automated**:

1. **GitHub Actions automatically** creates a "Release PR" when changesets are pushed to main
2. **Review the Release PR** - it contains version bumps and updated changelogs
3. **Merge the Release PR** - this automatically publishes all packages to npm

**No manual commands needed!** 🎉

### Changeset Types

- **Patch** (0.1.0 → 0.1.1): Bug fixes, documentation updates
- **Minor** (0.1.0 → 0.2.0): New features, non-breaking changes  
- **Major** (0.1.0 → 1.0.0): Breaking changes

### Example Workflow

```bash
# 1. Make your changes
git checkout -b feature/new-hook
# ... make changes ...

# 2. Create changeset
bun changeset
# Select packages: @firtoz/router-toolkit
# Select bump: minor
# Summary: "Add useDynamicRouter hook for enhanced routing"

# 3. Commit everything
git add .
git commit -m "feat(router-toolkit): add useDynamicRouter hook"
git push origin feature/new-hook

# 4. Open PR and merge it
# 5. GitHub Actions automatically creates a Release PR
# 6. Maintainer merges Release PR → automatic npm publish! 🚀
```

### 🤖 **What GitHub Actions Does:**

1. **Detects changesets** in commits pushed to main
2. **Creates Release PR** with:
   - Updated package versions
   - Generated changelogs
   - All affected packages included
3. **When Release PR is merged**:
   - Publishes packages to npm
   - Creates GitHub releases
   - Updates repository tags

## Code Quality

### TypeScript

All packages use TypeScript with strict settings. Make sure your code:
- Has proper type annotations
- Passes `bun run typecheck`
- Follows the existing code patterns

### Linting

We use [Biome](https://biomejs.dev/) for linting and formatting:

```bash
# Check for linting issues
bun run lint

# Fix auto-fixable issues
bun run format
```

### Testing

While we don't have extensive tests yet, when adding new features:
- Consider adding tests for complex logic
- Test your changes manually
- Ensure existing functionality isn't broken

## Package Structure

### Adding New Packages

Adding a new package to the monorepo:

1. **Create package directory**: `mkdir packages/your-new-package`
2. **Add `package.json`** with the correct name and structure
3. **Add `tsconfig.json`** (copy from existing packages)
4. **Add package scope** to `commitlint.config.ts` scopes array
5. **Create a changeset** when ready to publish:
   ```bash
   bun changeset
   ```
6. **That's it!** 🎉 Changesets will handle the new package in releases

### Example: Adding `@firtoz/new-package`

```bash
# 1. Create the package
mkdir packages/new-package
cd packages/new-package

# 2. Create package.json (update name, description, etc.)
cp ../maybe-error/package.json ./package.json

# 3. Copy configs
cp ../maybe-error/tsconfig.json ./

# 4. Create your code
mkdir src && echo 'export const hello = "world";' > src/index.ts

# 5. Update root commitlint config
# Add "new-package" to the scope-enum array in commitlint.config.ts

# 6. Create changeset for initial release
bun changeset
# Select: @firtoz/new-package
# Type: minor (for new package)
# Summary: "Initial implementation of new-package"

# 7. Commit and push
git add .
git commit -m "feat(new-package): initial implementation"
git push origin main

# 🎉 Ready for release when maintainer runs changeset publish!
```

### Inter-package Dependencies

When one package depends on another:
- Use `workspace:*` in `package.json`
- Import using the full package name (e.g., `@firtoz/maybe-error`)
- Update TypeScript path mappings if needed

## Documentation

### README Updates

- Update package READMEs when adding new features
- Keep examples up-to-date
- Use TypeScript in all code examples

### API Documentation

- Use JSDoc comments for public APIs
- Include usage examples in comments
- Document parameter types and return values

## Questions?

If you have questions about contributing:
- Check existing issues and discussions
- Create a new issue for bugs or feature requests
- Start a discussion for general questions

Thank you for contributing! 🎉 