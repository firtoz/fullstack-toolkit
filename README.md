# Fullstack Toolkit Monorepo

A monorepo containing TypeScript utilities for full-stack web development, including React Router, error handling, and edge computing utilities.

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

### [@firtoz/hono-fetcher](./packages/hono-fetcher)

Type-safe Hono API client with full TypeScript inference for routes, params, and payloads.

- 🔒 **Fully Type-Safe** - Complete TypeScript inference for routes, parameters, and responses
- 🎯 **Path Parameters** - Automatic extraction and validation of path parameters
- 📝 **Request Bodies** - Type-safe JSON and form data support
- 🌐 **Cloudflare Workers** - First-class Durable Objects support
- 🚀 **Zero Runtime Overhead** - All type inference at compile time

### [@firtoz/websocket-do](./packages/websocket-do)

Type-safe WebSocket session management for Cloudflare Durable Objects with Hono integration.

- 🔒 **Type-safe** - Full TypeScript support with generic types for messages and session data
- 🌐 **WebSocket Management** - Built on Cloudflare Durable Objects for stateful connections
- 🎯 **Session-based** - Abstract session class for custom WebSocket logic
- 🔄 **State Persistence** - Automatic serialization/deserialization of session data
- 📡 **Broadcasting** - Built-in support for broadcasting messages
- 🚀 **Hono Integration** - Seamless integration with Hono framework

## Installation

Each package can be installed independently:

```bash
# For React Router utilities
bun add @firtoz/router-toolkit

# For error handling utilities
bun add @firtoz/maybe-error

# For Hono API client
bun add @firtoz/hono-fetcher

# For WebSocket Durable Objects
bun add @firtoz/websocket-do

# Or install multiple packages
bun add @firtoz/router-toolkit @firtoz/maybe-error @firtoz/hono-fetcher @firtoz/websocket-do
```

## Development

This monorepo uses [Bun](https://bun.sh/) as the package manager, [Turborepo](https://turbo.build/) for task orchestration, and [Changesets](https://github.com/changesets/changesets) for automated versioning and publishing.

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

Turborepo automatically runs scripts across all packages. You can also run scripts on individual packages:

```bash
# Run commands across all packages (using Turborepo)
bun run typecheck  # Runs typecheck in all packages
bun run lint       # Runs lint in all packages
bun run format     # Runs format in all packages

# Run commands on specific packages (using Bun workspaces)
bun run --filter="@firtoz/router-toolkit" typecheck
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
feat(hono-fetcher): add support for custom headers
fix(websocket-do): handle connection errors gracefully
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

- [GitHub Repository](https://github.com/firtoz/fullstack-toolkit)
- [Router Toolkit on NPM](https://npmjs.com/package/@firtoz/router-toolkit)
- [Maybe Error on NPM](https://npmjs.com/package/@firtoz/maybe-error)
- [Hono Fetcher on NPM](https://npmjs.com/package/@firtoz/hono-fetcher)
- [WebSocket DO on NPM](https://npmjs.com/package/@firtoz/websocket-do)
- [React Router Documentation](https://reactrouter.com)
- [Hono Documentation](https://hono.dev)
- [Cloudflare Durable Objects Documentation](https://developers.cloudflare.com/durable-objects) 