# @firtoz/db-helpers

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fdb-helpers.svg)](https://www.npmjs.com/package/@firtoz/db-helpers)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fdb-helpers.svg)](https://www.npmjs.com/package/@firtoz/db-helpers)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fdb-helpers.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TanStack DB](https://img.shields.io/badge/TanStack_DB-000000?logo=react&logoColor=61DAFB)](https://tanstack.com/db)

**Small helpers for [TanStack DB](https://tanstack.com/db)** — published as compiled `dist/` with types on npm. Memory collections, sync adapters, and more as the toolkit grows.

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
