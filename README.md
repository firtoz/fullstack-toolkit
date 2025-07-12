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
npm install @firtoz/router-toolkit

# For error handling utilities
npm install @firtoz/maybe-error

# Or both
npm install @firtoz/router-toolkit @firtoz/maybe-error
```

## Development

This monorepo uses [Bun](https://bun.sh/) as the package manager and [multi-semantic-release](https://github.com/dhoulb/multi-semantic-release) for automated versioning with automatic package discovery.

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

Releases are fully automated using [multi-semantic-release](https://github.com/dhoulb/multi-semantic-release) with **automatic package discovery**. Simply commit using conventional commit messages and push to main:

```bash
# These commits will trigger releases automatically:
git commit -m "feat(router-toolkit): add new feature"     # → Minor version bump
git commit -m "fix(maybe-error): fix bug"                 # → Patch version bump  
git commit -m "feat(router-toolkit)!: breaking change"    # → Major version bump
git push origin main
```

### ✨ **Auto-Discovery Benefits:**
- 🔍 **Automatic package detection** - No need to update CI workflow for new packages
- 🎯 **Smart releases** - Only packages with relevant changes get released
- 🚀 **Zero maintenance** - Add new packages by just creating them in `packages/`
- 📦 **Dependency handling** - Automatically bumps dependent packages when dependencies change

## License

MIT © [Firtina Ozbalikchi](https://github.com/firtoz)

## Links

- [GitHub Repository](https://github.com/firtoz/router-toolkit)
- [Router Toolkit on NPM](https://npmjs.com/package/@firtoz/router-toolkit)
- [Maybe Error on NPM](https://npmjs.com/package/@firtoz/maybe-error)
- [React Router Documentation](https://reactrouter.com) 