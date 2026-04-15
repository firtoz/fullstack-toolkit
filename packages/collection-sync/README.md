# @firtoz/collection-sync

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fcollection-sync.svg)](https://www.npmjs.com/package/@firtoz/collection-sync)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fcollection-sync.svg)](https://www.npmjs.com/package/@firtoz/collection-sync)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fcollection-sync.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TanStack DB](https://img.shields.io/badge/TanStack_DB-000000?logo=react&logoColor=61DAFB)](https://tanstack.com/db)
[![WebSocket](https://img.shields.io/badge/WebSocket-sync-6366f1)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

**Real-time sync for [TanStack DB](https://tanstack.com/db) collections over WebSockets**—shared Zod message schemas, client/server bridges, optional partial sync and viewport-aware caching for large datasets.

## Installation

```bash
npm install @firtoz/collection-sync @tanstack/db @standard-schema/spec @firtoz/websocket-do react @tanstack/react-db
```

Also: `pnpm add` · `bun add` · `yarn add`

Peers include `@firtoz/websocket-do`, `@tanstack/db`, `@tanstack/react-db`, `react`, and `@standard-schema/spec`. Wire your Durable Object or server to the protocol types exported from the package root.

## React entry

Import hooks and adapters from the dedicated subpath:

```ts
import { /* … */ } from "@firtoz/collection-sync/react";
```

## Core exports

The package root exposes protocol types (`SyncClientMessage`, `SyncServerMessage`, …), bridges (`SyncClientBridge`, `SyncServerBridge`, `PartialSyncClientBridge`, …), `withSync` for wrapping collections, and related utilities. See `src/index.ts` for the full public API.

## Related

- [`@firtoz/idb-collections`](https://www.npmjs.com/package/@firtoz/idb-collections) — IndexedDB-backed collections
- [`@firtoz/db-helpers`](https://www.npmjs.com/package/@firtoz/db-helpers) — shared TanStack DB helpers

## Links

- [GitHub](https://github.com/firtoz/fullstack-toolkit/tree/main/packages/collection-sync) · [Issues](https://github.com/firtoz/fullstack-toolkit/issues)

## License

MIT © [Firtina Ozbalikchi](https://github.com/firtoz)
