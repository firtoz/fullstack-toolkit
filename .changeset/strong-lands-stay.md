---
"@firtoz/socka": patch
---

Fix generic contract bounds: add `SockaContractConfigBound` / `SockaContractBound` and use them (with `InferSocka*` helpers) so `defineSocka` contracts **with** server `pushes` assign to `SockaDoSession`, `SockaSession`, and related APIs. The previous `extends SockaContract<SockaContractConfig>` shape incorrectly required `pushes` to match `Record<string, never>`.
