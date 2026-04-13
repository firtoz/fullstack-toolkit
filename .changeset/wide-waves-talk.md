---
"@firtoz/websocket-do": patch
"socka": patch
---

Optional `createData` on `BaseSessionHandlers`: when omitted, `startFresh` initializes session `data` as `{}`.

`SockaDoSessionConfig` allows omitting `createData` when `TData` is `Record<string, never>` (default `TData` generic on `SockaDoSession`).
