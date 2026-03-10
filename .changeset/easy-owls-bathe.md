---
"@firtoz/router-toolkit": patch
---

Fix typing for `useDynamicSubmitter` submit options: explicitly type `method` as `HTMLFormMethod` and cast submit options so `fetcher.submit` receives correctly typed arguments when using form and JSON submit.
