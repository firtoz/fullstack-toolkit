---
"@firtoz/socka": minor
---

Add optional `reportError(error, info)` with discriminated `SockaReportErrorInfo` for client event pipeline, `onAttached`, and server adapter I/O; default remains `console.error`. Simplify RPC response/event validation to use `parseStandardSchema` directly without an extra microtask.
