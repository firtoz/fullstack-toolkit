# @firtoz/idb-collections

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fidb-collections.svg)](https://www.npmjs.com/package/@firtoz/idb-collections)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fidb-collections.svg)](https://www.npmjs.com/package/@firtoz/idb-collections)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fidb-collections.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TanStack DB](https://img.shields.io/badge/TanStack_DB-000000?logo=react&logoColor=61DAFB)](https://tanstack.com/db)
[![IndexedDB](https://img.shields.io/badge/IndexedDB-browser-2563eb)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

**Key-value collections on IndexedDB for [TanStack DB](https://tanstack.com/db)**—with a typed adapter, helpers to build key ranges from queries, and a path to fast local reads in the browser.

## Installation

```bash
npm install @firtoz/idb-collections @tanstack/db @standard-schema/spec
```

Also: `pnpm add` · `bun add` · `yarn add`

Peer dependencies: `@tanstack/db` and `@standard-schema/spec`. The package builds on [`@firtoz/db-helpers`](https://www.npmjs.com/package/@firtoz/db-helpers) for shared collection utilities.

## What you get

- **`createKeyValCollection` / `keyvalCollectionOptions`** — configure a TanStack DB collection backed by IndexedDB key-value storage.
- **`tryExtractIndexedQuery`**, **`KeyRangeSpec`** — translate query intent into IDB key ranges where possible.

## Usage

```ts
import {
	createKeyValCollection,
	keyvalCollectionOptions,
	tryExtractIndexedQuery,
} from "@firtoz/idb-collections";
```

See tests and consumers in the monorepo for full patterns.

## Links

- [GitHub](https://github.com/firtoz/fullstack-toolkit/tree/main/packages/idb-collections) · [Issues](https://github.com/firtoz/fullstack-toolkit/issues)

## License

MIT © [Firtina Ozbalikchi](https://github.com/firtoz)
