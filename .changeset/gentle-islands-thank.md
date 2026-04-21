---
"@firtoz/router-toolkit": patch
---

`useDynamicSubmitter`: reject in-flight `submit` / `submitJson` promises with `SubmitterSupersededError` when a newer submission starts on the **same React Router fetcher key**, including across separate hook instances. Unmount cleanup only rejects the pending promise owned by that instance.
