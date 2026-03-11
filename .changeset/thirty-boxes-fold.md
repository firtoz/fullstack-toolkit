---
"@firtoz/router-toolkit": major
---

Remove `useConcurrentDynamicSubmitter`. Use `ConcurrentSubmitterProvider` (at app root) and `useConcurrentSubmitter()` instead. Submissions go through the framework fetcher with path/args per call; see README for the new API.
