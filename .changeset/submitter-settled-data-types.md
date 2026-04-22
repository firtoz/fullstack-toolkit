---
"@firtoz/router-toolkit": patch
---

Align **`submit`** / **`submitJson`** promise types with existing behavior: they already only resolved when `fetcher.data` was defined. Add **`SubmitterSettledData<TInfo>`** (`NonNullable` of fetcher `data`) for that settled value; **`DynamicSubmitterData`** still reflects optional `data` over the fetcher lifecycle. **`useDynamicSubmitterFetcher`** unchanged.
