---
"@firtoz/router-toolkit": major
---

**Breaking:** Reorder `useConcurrentSubmitter` `submitJson` / `submitFormData` parameters so route args come directly after `path` (matching `useDynamicFetcher` / `useDynamicSubmitter`). Routes with no params can omit `args` entirely instead of passing `undefined`.

Also fix `exactOptionalPropertyTypes` compatibility by omitting `pendingSubmit` from settled operation state instead of setting it to `undefined`.
