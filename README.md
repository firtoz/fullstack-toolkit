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
- 🔌 **WebSocket Support** - Type-safe WebSocket connections with auto-accept
- 🚀 **Zero Runtime Overhead** - All type inference at compile time

### [@firtoz/websocket-do](./packages/websocket-do)

Type-safe WebSocket session management for Cloudflare Durable Objects with Zod validation.

- 🔒 **Type-safe** - Full TypeScript support with generic types for messages and session data
- ✨ **Zod Validation** - Runtime message validation with `ZodWebSocketClient` and `ZodSession`
- 🌐 **WebSocket Management** - Built on Cloudflare Durable Objects for stateful connections
- 🎯 **Session-based** - Abstract session class for custom WebSocket logic
- 🔄 **State Persistence** - Automatic serialization/deserialization of session data
- 📡 **Broadcasting** - Built-in support for broadcasting messages
- 📦 **Buffer Mode** - Efficient msgpack serialization for binary messaging
- 🚀 **Hono Integration** - Seamless integration with Hono framework and `@firtoz/hono-fetcher`

### [@firtoz/chat-agent](./packages/chat-agent)

Wire protocol, tools, and `ChatAgentBase` for Cloudflare Durable Objects with OpenRouter—a simplified alternative to `@cloudflare/ai-chat`. **Persistence** lives in sibling packages:

- **`@firtoz/chat-agent-drizzle`** — Drizzle ORM (recommended; ships migrations and `./db/schema`)
- **`@firtoz/chat-agent-sql`** — raw `this.sql` persistence

- 🤖 **OpenRouter Integration** - Simpler alternative to AI SDK for chat agents
- 🔄 **Resumable Streaming** - Chunk buffering with stream restoration on reconnect
- 🛠️ **Server & Client Tools** - Support for both server-side and client-side tool execution
- 💾 **DB Agnostic** - Install Drizzle or SQL package alongside core
- 🌐 **AI Gateway Support** - Built-in Cloudflare AI Gateway integration
- 📦 **Message Persistence** - Automatic message storage in Durable Objects SQLite
- 🎯 **Type-safe** - Full TypeScript support; Drizzle path uses typed schema

### [@firtoz/drizzle-indexeddb](./packages/drizzle-indexeddb) ⚠️ WIP

TanStack DB collections backed by IndexedDB with automatic migrations powered by Drizzle ORM.

- ⚡ **TanStack DB collections** - Reactive collections with type safety
- 🎯 **Type-safe** - Full TypeScript support with automatic type inference
- 🔍 **Query optimization** - Leverage IndexedDB indexes for fast queries
- 📦 **Soft deletes** - Built-in support for `deletedAt` column
- ⚛️ **React hooks** - Provider and hooks for easy React integration
- 📝 **Function-based migrations** - Generated migration functions from Drizzle schema changes
- 🔄 **Multi-client sync** - IDB Proxy system for real-time sync across multiple clients

### [@firtoz/drizzle-sqlite-wasm](./packages/drizzle-sqlite-wasm) ⚠️ WIP

TanStack DB collections backed by SQLite WASM running in Web Workers, with full Drizzle ORM integration.

- 📦 **TanStack DB collections** - Reactive collections with type safety
- 🔄 **Web Worker support** - Non-blocking SQLite in a dedicated worker
- ⚡ **Drizzle ORM** - Full type-safe query builder
- 🎯 **Type-safe** - Full TypeScript support with automatic type inference
- ⚛️ **React hooks** - Provider and hooks for easy integration
- 🔄 **Migrations** - Automatic schema migrations with Drizzle snapshots
- 🔌 **Bundler agnostic** - Works with Vite, Webpack, Parcel, and more

### [@firtoz/drizzle-utils](./packages/drizzle-utils) ⚠️ WIP

Shared utilities and types for Drizzle ORM-based packages.

- 🏗️ **Syncable Table Builder** - Tables with automatic timestamp tracking and UUID primary keys
- 🏷️ **Branded ID Types** - Type-safe IDs with table-specific branding
- 📋 **Column Helpers** - Individual column builders for custom table definitions
- 🔄 **Migration Types** - Shared TypeScript types for Drizzle migrations
- 📝 **Schema Type Helpers** - Type-safe Valibot schema inference

### [@firtoz/worker-helper](./packages/worker-helper) ⚠️ WIP

Type-safe Web Worker helper with Zod validation for input and output messages.

- 🔒 **Type-safe** - Full TypeScript support with automatic type inference
- ✅ **Zod Validation** - Automatic validation of both input and output messages
- 🎯 **Custom Error Handlers** - Complete control over error handling
- 🔄 **Async Support** - Built-in support for async message handlers
- 🧩 **Discriminated Unions** - Works great with Zod's discriminated unions for type-safe message routing

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

# For ChatAgent with OpenRouter (core + peers; add drizzle or sql package for persistence)
bun add @firtoz/chat-agent @openrouter/sdk agents
# bun add @firtoz/chat-agent-drizzle drizzle-orm
# or: bun add @firtoz/chat-agent-sql

# For IndexedDB with Drizzle (WIP)
bun add @firtoz/drizzle-indexeddb @firtoz/drizzle-utils drizzle-orm @tanstack/db

# For SQLite WASM with Drizzle (WIP)
bun add @firtoz/drizzle-sqlite-wasm @firtoz/drizzle-utils drizzle-orm @tanstack/db

# For type-safe Web Workers (WIP)
bun add @firtoz/worker-helper zod
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

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for consistent commit message formatting, while [Changesets](https://github.com/changesets/changesets) handles automated versioning and changelog generation.

Examples:
```bash
feat(router-toolkit): add new hook for dynamic routing
fix(maybe-error): resolve type inference issue
feat(hono-fetcher): add support for custom headers
fix(websocket-do): handle connection errors gracefully
feat(drizzle-indexeddb): add support for composite indexes
fix(drizzle-sqlite-wasm): fix worker initialization race condition
feat(drizzle-utils): add new column helper for JSON fields
fix(worker-helper): improve async error handling
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
- [Chat Agent on NPM](https://npmjs.com/package/@firtoz/chat-agent)
- [Drizzle IndexedDB on NPM](https://npmjs.com/package/@firtoz/drizzle-indexeddb)
- [Drizzle SQLite WASM on NPM](https://npmjs.com/package/@firtoz/drizzle-sqlite-wasm)
- [Drizzle Utils on NPM](https://npmjs.com/package/@firtoz/drizzle-utils)
- [Worker Helper on NPM](https://npmjs.com/package/@firtoz/worker-helper)
- [React Router Documentation](https://reactrouter.com)
- [Hono Documentation](https://hono.dev)
- [Cloudflare Durable Objects Documentation](https://developers.cloudflare.com/durable-objects)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [TanStack DB Documentation](https://tanstack.com/db) 