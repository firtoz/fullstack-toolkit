---
"@firtoz/socka": major
---

**Breaking:** Strict HTTP upgrade is the default for `SockaWebSocketSession`. `createData` receives `SockaStrictWebSocketInit` unless you use `SockaWebSocketSessionConfigLoose` with `strictUpgradeRequest: false` (tests, Node `ws` without a `Request`, inner DO engine). New types: `SockaWebSocketSessionConfigLoose`, `SockaWebSocketSessionConfigUnion`. Sessions constructed without an upgrade `Request` now throw unless loose.
