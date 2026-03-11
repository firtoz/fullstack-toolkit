---
"@firtoz/router-toolkit": minor
---

Add `ConcurrentSubmitterProvider` and `useConcurrentSubmitter` for concurrent form submissions via the framework fetcher. Use the global provider at the app root; path and args are passed per submission. Submissions go through React Router's fetcher so the correct `.data` URL and response decoding are handled by the framework.
