# @firtoz/hono-fetcher

## 2.0.0

### Major Changes

- [`8b85af2`](https://github.com/firtoz/fullstack-toolkit/commit/8b85af2940ae002fb376885bedfbfb341950b29c) Thanks [@firtoz](https://github.com/firtoz)! - Breaking change: Replace namespace.get(namespace.idFromName(name)) with namespace.getByName(name) in honoDoFetcherWithName function

## 1.1.0

### Minor Changes

- [`fd76fb4`](https://github.com/firtoz/fullstack-toolkit/commit/fd76fb447b82ccaafd2722a0cdcd9a6abcec25b5) Thanks [@firtoz](https://github.com/firtoz)! - Added honoDirectFetcher

## 1.0.0

### Major Changes

- [`8a5ca48`](https://github.com/firtoz/fullstack-toolkit/commit/8a5ca4836a2a1655cf0ef0f828e52a0c74efd7dd) Thanks [@firtoz](https://github.com/firtoz)! - Moving to @firtoz

## 0.0.0

### Initial Release

- Initial implementation of type-safe Hono API client
- Added `honoFetcher` for creating type-safe HTTP clients
- Added `honoDoFetcher` for Cloudflare Durable Objects integration
- Full TypeScript inference for routes, params, bodies, and responses
- Support for path parameters with automatic extraction
- Support for JSON and form data request bodies
- Helper functions: `honoDoFetcherWithName` and `honoDoFetcherWithId`
