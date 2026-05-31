---
"@firtoz/hono-fetcher": minor
"@firtoz/maybe-error": patch
"@firtoz/socka": patch
"@firtoz/websocket-do": minor
"@firtoz/router-toolkit": patch
---

Maintainer feedback DX improvements from cf-multiworker-starter-kit.

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
