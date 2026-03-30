---
"@firtoz/hono-fetcher": minor
---

Durable Object fetchers (`honoDoFetcher`, `honoDoFetcherWithName`, `honoDoFetcherWithId`) now implement `Disposable`. Use `using api = honoDoFetcherWithName(...)` in Workers to auto-dispose RPC stubs and silence "stub not disposed" warnings.
