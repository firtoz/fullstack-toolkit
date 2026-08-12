# Contributing to Fullstack Toolkit Monorepo

Thank you for your interest in contributing to the Fullstack Toolkit monorepo! This repository contains multiple packages that work together to provide TypeScript utilities for full-stack web development, including React Router, error handling, database management, and edge computing.

## 🎉 PRs Welcome!

**All packages in this monorepo are early works-in-progress and contributions are highly encouraged!** Whether you're fixing bugs, adding features, improving documentation, or helping with build tooling (like JavaScript builds), your contributions are welcome.

As the maintainer, I have limited time but will do my best to review and merge helpful PRs. Don't hesitate to:
- Fix bugs you encounter
- Add features you need
- Improve documentation
- Add tests
- Help with JavaScript/CommonJS builds
- Optimize performance
- Suggest improvements

If you're unsure about something, feel free to open an issue or discussion first!

## Packages

### Core Utilities
- **[@firtoz/router-toolkit](./packages/router-toolkit)** - React Router 7 framework mode utilities
- **[@firtoz/maybe-error](./packages/maybe-error)** - Type-safe error handling pattern
- **[@firtoz/hono-fetcher](./packages/hono-fetcher)** - Type-safe Hono API client

### Database & Storage (⚠️ Early WIP)
- **[@firtoz/drizzle-indexeddb](./packages/drizzle-indexeddb)** - IndexedDB collections with Drizzle migrations
- **[@firtoz/drizzle-sqlite-wasm](./packages/drizzle-sqlite-wasm)** - SQLite WASM in Web Workers with Drizzle
- **[@firtoz/drizzle-utils](./packages/drizzle-utils)** - Shared Drizzle utilities and types

### Workers & Edge
- **[@firtoz/websocket-do](./packages/websocket-do)** - WebSocket Durable Objects utilities
- **[@firtoz/worker-helper](./packages/worker-helper)** - Type-safe Web Worker communication

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

**Important:** Commit messages are for organization only. **[Changesets](https://changesets.dev) handle all versioning and releases.**

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

Releases use [Changesets](https://changesets.dev) v3 with GitHub Actions automation (`changesets/action@v2`).

### Workflow

1. **Make changes** and commit with conventional format
2. **Create changeset**: `bun changeset`
   - Select affected packages
   - Choose version bump type (patch/minor/major)
   - Write changelog summary
3. **Commit and push** (or open PR)
4. **GitHub Actions** automatically creates Release PR
5. **Merge Release PR** → automatic npm publish

### Why the “Version packages” PR looks huge

Changesets generates **one section per published package** that gets a version bump. Packages that only changed because a dependency bumped show **“Updated dependencies”** with commit hashes—that repetition is normal and is not something you fix by “merging” changesets.

**If one package (e.g. `@firtoz/socka`) should read as a single release story:** avoid **multiple pending `.changeset/*.md` files** that all bump the same package. Each file becomes its own changelog entry for that package.

- Prefer **one changeset per PR** that lists every affected package in the same file when the work is one logical release.
- If several changesets on `main` all bump `@firtoz/socka` with separate bodies, you can **consolidate before the Release PR lands**: merge the prose into **one** file, list `@firtoz/socka` once in the frontmatter, and remove the redundant `.md` files (often done on the Release PR branch).

Private apps under `examples/` and `tests/` are listed in `.changeset/config.json` **`ignore`**, so they are not versioned in release notes.

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

## Areas Where Help Is Especially Welcome

### Build Tooling
- JavaScript/CommonJS builds for better compatibility
- ESM/CJS dual package support
- Build optimization

### Documentation
- More examples and use cases
- Better API documentation
- Tutorials and guides

### Testing
- Unit tests
- Integration tests
- E2E tests

### Features
- New features you need
- Performance improvements
- TypeScript improvements

### Bug Fixes
- Any bugs you encounter
- Edge cases
- Browser compatibility

## Questions?

- Check existing issues/discussions
- Create new issue for bugs/features
- Start discussion for general questions
- Open a PR even if you're not sure - we can iterate together!

## Note on Package Maturity

Many packages are in early WIP stage and **not production-ready**. They're TypeScript-only for now. If you need:
- JavaScript builds
- Better browser compatibility
- Additional features
- Bug fixes

Please don't hesitate to submit a PR! While I have limited time as the maintainer, I'm committed to reviewing and merging helpful contributions.

Thank you for contributing! 