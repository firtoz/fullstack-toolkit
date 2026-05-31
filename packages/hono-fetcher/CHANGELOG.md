# @firtoz/hono-fetcher

## 2.8.0

### Minor Changes

- [`1656f83`](https://github.com/firtoz/fullstack-toolkit/commit/1656f8383ef99cdf698a6660789d8e42632ea69e) Thanks [@firtoz](https://github.com/firtoz)! - Maintainer feedback DX improvements from cf-multiworker-starter-kit.

  **@firtoz/hono-fetcher**

  - `DoRpcWithApp`, `honoFetcherMounted`, `HonoClientApp`, `MountedClientApp`, `ValidMountPrefix`, `MountPathParams`
  - `honoFetcherMounted(app, mountPath)` app-first overload; multi-segment mounts (`/nested/deep`); parametric mounts (`/level1/:param` + `mountParams`)
  - `exactOptionalPropertyTypes`-friendly optional `query` / `init` types
  - README: local dev `using res`, RpcDisposableJsonResponse vs proxy typing, query params, mounted clients

  **@firtoz/socka**

  - `require` / `default` export conditions on all package subpaths (Node tooling / drizzle-kit)
  - Docs: DO HTTP route chaining + `broadcastPushToAll`, SSR checklist, auth pre-upgrade vs `createData`

  **@firtoz/websocket-do**

  - `beforeWebSocket(ctx)` hook on `BaseWebSocketDO` for HTTP rejection before WebSocket upgrade

  **@firtoz/router-toolkit**

  - Cross-link `@firtoz/maybe-error` in README; trim duplicated MaybeError API reference

  **@firtoz/maybe-error**

  - Reciprocal README cross-link to `@firtoz/router-toolkit`

## 2.7.2

### Patch Changes

- [`bf246d7`](https://github.com/firtoz/fullstack-toolkit/commit/bf246d7ae9c1555886d39aab56378bc024d82c14) Thanks [@firtoz](https://github.com/firtoz)! - Align WebSocket close handling with Cloudflare’s pre- and post–2026-04-07 close semantics: complete the Close handshake with the peer’s `code`/`reason` in `webSocketClose`, and make `webSocketError` close idempotent. Add optional `pairServerWebSocketAcceptOptions` on `BaseWebSocketDO` / `StandardSchemaWebSocketDO` and `SockaWebSocketDO` for `WebSocket#accept` (e.g. `allowHalfOpen`), and optional `acceptOptions` on the hono fetcher’s WebSocket config for the same.

## 2.7.1

### Patch Changes

- [`1e057aa`](https://github.com/firtoz/fullstack-toolkit/commit/1e057aad4b252223f4269a9bc6bd01a744cf56a8) Thanks [@firtoz](https://github.com/firtoz)! - **@firtoz/router-toolkit:** Stop re-exporting `@firtoz/maybe-error` from the package entry so `.d.ts` matches runtime. `@firtoz/maybe-error` is now a regular dependency; import `success`, `fail`, `MaybeError`, `exhaustiveGuard`, and related symbols from `@firtoz/maybe-error` directly.

  **@firtoz/hono-fetcher** and **@firtoz/worker-helper:** Regenerate root `index.d.ts` after tsup so type-only symbols use `export type { ... }`, for compatibility with stricter consumer compiler settings.

  **@firtoz/drizzle-sqlite-wasm:** Remove re-exports of `@firtoz/drizzle-utils` (`syncableTable`, `makeId`, branded/schema types, `SQLOperation`, `SQLInterceptor`) from the package entry. Import those from `@firtoz/drizzle-utils` directly.

  **@firtoz/drizzle-durable-sqlite:** Stop re-exporting `SQLOperation` and `SQLInterceptor` from the package entry; import them from `@firtoz/drizzle-utils` when needed.

## 2.7.0

### Minor Changes

- [`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd) Thanks [@firtoz](https://github.com/firtoz)! - Publish compiled ESM and TypeScript declarations from `dist/` for each package (`tsup`, `prepack` build). `exports`, `main`, and `types` resolve to `dist/`; CLI bins point at built JS with a Node shebang where applicable. Shared `scripts/tsup-lib.ts` discovers `src` entries and externals; workspace test apps map `@firtoz/*` to package sources in `tsconfig` for accurate generics during typecheck. `@firtoz/socka` is published under the scoped name with the same `dist/` layout.

### Patch Changes

- [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe) Thanks [@firtoz](https://github.com/firtoz)! - Improve READMEs: npm shields, contextual stack badges, clearer taglines, and new docs for `@firtoz/idb-collections` and `@firtoz/collection-sync`. Align `@firtoz/db-helpers` copy with published `dist/` builds.

## 2.6.0

### Minor Changes

- [`9a38d77`](https://github.com/firtoz/fullstack-toolkit/commit/9a38d77c5502ea10d6104918afd3527ffbfbb82d) Thanks [@firtoz](https://github.com/firtoz)! - Document Durable Object RPC stub vs `Response` disposal (aligned with Cloudflare’s **[Workers RPC lifecycle](https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/)**). **`TypedDoFetcher`** / full **`DurableObjectStub`**: HTTP/WebSocket results typed as **`RpcDisposableJsonResponse`** / **`Response & Disposable`** so **`using resp`** type-checks with **`"ESNext.Disposable"`** in `lib`. **`Pick<stub, "fetch">`** mocks: **`TypedHonoFetcher<Hono>`** with **no** `Disposable` on responses so typings are not faked when disposers are absent.

## 2.5.0

### Minor Changes

- [`fb45a10`](https://github.com/firtoz/fullstack-toolkit/commit/fb45a1056cdca508e3670b611bfcdf833efb5070) Thanks [@firtoz](https://github.com/firtoz)! - Durable Object fetchers (`honoDoFetcher`, `honoDoFetcherWithName`, `honoDoFetcherWithId`) now implement `Disposable`. Use `using api = honoDoFetcherWithName(...)` in Workers to auto-dispose RPC stubs and silence "stub not disposed" warnings. See Cloudflare’s [Workers RPC lifecycle](https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/) for RPC `Disposable` / `using` / `DisposableStack` guidance.

## 2.4.1

### Patch Changes

- [`05d3b24`](https://github.com/firtoz/fullstack-toolkit/commit/05d3b244f081c634e3128b558f0ad4cbb261fb56) Thanks [@firtoz](https://github.com/firtoz)! - Fix `RequestInit` merging: spreading `init` after computed `headers` no longer replaces merged headers (including `Content-Type` for JSON bodies) or overrides method/body. Custom `init.headers` are merged with library defaults.

## 2.4.0

### Minor Changes

- [`0cd07e4`](https://github.com/firtoz/fullstack-toolkit/commit/0cd07e4e87ed6302b3de652c0a2a25e68cb41820) Thanks [@firtoz](https://github.com/firtoz)! - Add optional `query` record on fetcher requests (alongside `params` and `init`) to append URL search parameters. `null` and `undefined` values are omitted. Export `HonoFetcherQueryParams` and `HonoFetcherQueryParamValue`.

## 2.3.2

### Patch Changes

- [`b84d9ee`](https://github.com/firtoz/fullstack-toolkit/commit/b84d9ee3cdb60e3e0bb78eb7415dbf4886f8a302) Thanks [@firtoz](https://github.com/firtoz)! - Updated peer dependency:

  - `hono`: ^4.11.3 → ^4.11.4

## 2.3.1

### Patch Changes

- [`e879407`](https://github.com/firtoz/fullstack-toolkit/commit/e8794074e3803b45cbf1d754b99b5cfb82e7fb2c) Thanks [@firtoz](https://github.com/firtoz)! - fix npmrc

## 2.3.0

### Minor Changes

- [`0317659`](https://github.com/firtoz/fullstack-toolkit/commit/0317659a87fa7be9bb47130fe6ad8004562fd277) Thanks [@firtoz](https://github.com/firtoz)! - Try fixing catalogs maybe

## 2.2.0

### Minor Changes

- [`8f7ddf7`](https://github.com/firtoz/fullstack-toolkit/commit/8f7ddf7a200a5b4133ba16f32b9d46da97a8344d) Thanks [@firtoz](https://github.com/firtoz)! - Try using catalog for deps in monorepo

## 2.1.0

### Minor Changes

- [`c38877a`](https://github.com/firtoz/fullstack-toolkit/commit/c38877a21b3879eb41ae457aac35ea9d5eac6db7) Thanks [@firtoz](https://github.com/firtoz)! - Enable websocket connections in honoFetcher

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
