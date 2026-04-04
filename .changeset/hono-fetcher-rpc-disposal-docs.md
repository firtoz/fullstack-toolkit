---
"@firtoz/hono-fetcher": minor
---

Document Durable Object RPC stub vs `Response` disposal (aligned with Cloudflare’s **[Workers RPC lifecycle](https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/)**). **`TypedDoFetcher`** / full **`DurableObjectStub`**: HTTP/WebSocket results typed as **`RpcDisposableJsonResponse`** / **`Response & Disposable`** so **`using resp`** type-checks with **`"ESNext.Disposable"`** in `lib`. **`Pick<stub, "fetch">`** mocks: **`TypedHonoFetcher<Hono>`** with **no** `Disposable` on responses so typings are not faked when disposers are absent.
