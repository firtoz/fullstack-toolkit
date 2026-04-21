---
"@firtoz/router-toolkit": major
---

**Breaking:** `useDynamicSubmitter` now returns only a stable, memoized `{ submit, submitJson, Form }`. It no longer spreads the React Router fetcher, so `state`, `data`, `error`, and other fetcher fields are not on the hook result. Use `await submit` / `await submitJson` for action payloads; use local React state for loading flags, or pair with `useFetcher({ key: dynamicSubmitterFetcherKey(href(path, ...args)) })` for the same submission lifecycle in JSX. New helper: `dynamicSubmitterFetcherKey(resolvedHref)`.
