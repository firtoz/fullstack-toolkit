# @firtoz/db-helpers

TanStack DB helpers and utilities. TypeScript-only, no build step—consume source directly.

This package is a small collection of helpers for [@tanstack/db](https://tanstack.com/db). More utilities will be added over time.

## Current helpers

- **Memory collection** – In-memory TanStack DB collection with sync adapter and `truncate` utility. Useful for tests and ephemeral state.

## Installation

```bash
bun add @firtoz/db-helpers
# or npm/pnpm/yarn
```

Peer dependencies: `@tanstack/db` and `@standard-schema/spec`.

## Usage

```ts
import {
  createMemoryCollection,
  memoryCollectionOptions,
  type MemoryCollection,
} from "@firtoz/db-helpers";
```

See [@tanstack/db](https://tanstack.com/db) docs for collection usage.

## License

MIT
