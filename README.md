# Router Toolkit Monorepo

A monorepo containing TypeScript utilities for React Router and general-purpose error handling.

## Packages

### [@firtoz/router-toolkit](./packages/router-toolkit)

Type-safe React Router 7 framework mode helpers with enhanced fetching, form submission, and state management.

- 🚀 **Enhanced fetching** - Dynamic fetchers with caching and query parameter support
- 📝 **Form submission** - Type-safe form handling with Zod validation
- 🔄 **State tracking** - Monitor fetcher state changes with ease
- 🎯 **Zero configuration** - Works out of the box with React Router 7

### [@firtoz/maybe-error](./packages/maybe-error)

Type-safe result handling with the MaybeError pattern for TypeScript.

- ✅ **Type-safe error handling** - Full TypeScript support with discriminated unions
- 🚀 **Zero dependencies** - Lightweight and fast
- 📦 **Tree-shakeable** - Import only what you need
- 🎯 **Simple API** - Easy to use and understand
- 🔧 **Modern TypeScript** - Optimized for TypeScript 5.0+ with enhanced type inference

## Installation

Each package can be installed independently:

```bash
# For React Router utilities
bun add @firtoz/router-toolkit

# For error handling utilities
bun add @firtoz/maybe-error

# Or both
bun add @firtoz/router-toolkit @firtoz/maybe-error
```

## Development

This monorepo uses [Bun](https://bun.sh/) as the package manager and [Changesets](https://github.com/changesets/changesets) for automated versioning and publishing.

### Getting Started

```bash
# Install dependencies
bun install

# Type check all packages
bun run typecheck

# Lint all packages
bun run lint

# Format all packages
bun run format
```

### Package Scripts

You can also run scripts on individual packages:

```bash
# Type check only router-toolkit
bun run --filter="@firtoz/router-toolkit" typecheck

# Lint only maybe-error
bun run --filter="@firtoz/maybe-error" lint
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Commit Message Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation.

Examples:
```bash
feat(router-toolkit): add new hook for dynamic routing
fix(maybe-error): resolve type inference issue
docs: update README with new examples
```

## Releases

Releases are fully automated using [Changesets](https://github.com/changesets/changesets) with GitHub Actions:

1. **Make your changes** and commit them
2. **Create a changeset** describing your changes:
   ```bash
   bun changeset
   ```
3. **Push to main** (or merge your PR)
4. **GitHub Actions automatically**:
   - Creates a "Release PR" with version bumps and changelog updates
   - When you merge the Release PR → automatically publishes to npm

### 🤖 **Automated Workflow:**
- 🔄 **Auto Release PRs** - GitHub Actions creates PRs with version bumps
- 📦 **Auto Publishing** - Merging the Release PR triggers npm publish
- 📝 **Rich changelogs** - Detailed release notes with GitHub integration
- 🔗 **Dependency handling** - Automatically bumps dependent packages
- 🎯 **Zero maintenance** - No manual version management needed

## License

MIT © [Firtina Ozbalikchi](https://github.com/firtoz)

## Links

- [GitHub Repository](https://github.com/firtoz/router-toolkit)
- [Router Toolkit on NPM](https://npmjs.com/package/@firtoz/router-toolkit)
- [Maybe Error on NPM](https://npmjs.com/package/@firtoz/maybe-error)
- [React Router Documentation](https://reactrouter.com) 