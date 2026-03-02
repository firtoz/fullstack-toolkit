---
"@firtoz/router-toolkit": minor
---

Add `useConcurrentDynamicSubmitter` for multiple concurrent form submissions to the same action. Each submission is tracked independently (pending → done/error) via an `operations` map and returns `{ id, promise }` so you can await and correlate results without using multiple fetchers.
