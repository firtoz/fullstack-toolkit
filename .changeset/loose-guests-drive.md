---
"@firtoz/socka": minor
---

Optional `output` on `defineSocka` calls enables fire-and-forget RPC: no `serverResponse` on success, client `send` resolves after the request is sent; failures still use `serverError` with optional `rpc`. `SockaError` and `reportError` gain related fields/kinds. Documentation updated (`z.void()` vs omitted `output`).
