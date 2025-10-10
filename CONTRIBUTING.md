# Contributing to Fullstack Toolkit Monorepo

Thank you for your interest in contributing to the Fullstack Toolkit monorepo! This repository contains multiple packages that work together to provide TypeScript utilities for full-stack web development, including React Router, error handling, and edge computing.

## Packages

- **[@firtoz/router-toolkit](./packages/router-toolkit)** - React Router 7 utilities
- **[@firtoz/maybe-error](./packages/maybe-error)** - Type-safe error handling
- **[@firtoz/hono-fetcher](./packages/hono-fetcher)** - Type-safe Hono API client
- **[@firtoz/websocket-do](./packages/websocket-do)** - WebSocket Durable Objects utilities

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

We use [Conventional Commits](https://www.conventionalcommits.org/) for consistency. Format: `<type>[scope]: <description>`

**Important:** Commit messages are for organization only. **[Changesets](https://github.com/changesets/changesets) handle all versioning and releases.**

### Types & Scopes
- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **Scopes**: `router-toolkit`, `maybe-error`, `hono-fetcher`, `websocket-do` (or no scope)

### Examples
```bash
feat(router-toolkit): add new hook for dynamic routing
fix(maybe-error): resolve type inference issue
docs: update README with new examples
```

## Making Changes

1. Create branch from `main`
2. Make changes in appropriate package
3. Add tests and update docs
4. Run `bun run typecheck` and `bun run lint`
5. Commit with conventional format
6. Open pull request

## Release Process

Releases use [Changesets](https://github.com/changesets/changesets) with GitHub Actions automation.

### Workflow

1. **Make changes** and commit with conventional format
2. **Create changeset**: `bun changeset`
   - Select affected packages
   - Choose version bump type (patch/minor/major)
   - Write changelog summary
3. **Commit and push** (or open PR)
4. **GitHub Actions** automatically creates Release PR
5. **Merge Release PR** → automatic npm publish

### Version Types
- **Patch**: Bug fixes, docs (`1.0.0 → 1.0.1`)
- **Minor**: New features (`1.0.0 → 1.1.0`)  
- **Major**: Breaking changes (`1.0.0 → 2.0.0`)

### Example
```bash
# Make changes
git commit -m "feat(router-toolkit): add email validation"

# Create changeset
bun changeset
# Select: @firtoz/router-toolkit, minor, "Add email validation"

# Commit and push
git add .changeset/ && git commit -m "chore: add changeset"
git push

# GitHub Actions creates Release PR automatically
# Merge Release PR → publishes to npm
```

## Code Quality

### TypeScript
- Use strict settings and proper type annotations
- Ensure `bun run typecheck` passes
- Follow existing patterns

### Linting
We use [Biome](https://biomejs.dev/):
```bash
bun run lint    # Check issues
bun run format  # Fix auto-fixable issues
```

### Testing
- Add tests for complex logic
- Test changes manually
- Ensure existing functionality works

## Adding New Packages

1. Create package directory: `mkdir packages/your-package`
2. Copy `package.json` and `tsconfig.json` from existing package
3. Update package name and details
4. Add scope to `commitlint.config.ts` (optional)
5. Create changeset for release: `bun changeset`

### Inter-package Dependencies
- Use `workspace:*` in `package.json` 
- Import with full package name (e.g., `@firtoz/maybe-error`)

## Documentation

- Update package READMEs when adding features
- Use TypeScript in all examples
- Add JSDoc comments for public APIs

## Questions?

- Check existing issues/discussions
- Create new issue for bugs/features
- Start discussion for general questions

Thank you for contributing! 