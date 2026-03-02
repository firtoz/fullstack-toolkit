---
"@firtoz/router-toolkit": patch
---

Add optional `options` to `submitFormData`: `submitFormData(formData, submittedData?, options?)` with `options.headers` (e.g. `Accept: application/json` so the action returns JSON instead of redirecting) and `options.method`. Export `SubmitFormDataOptions` type.
