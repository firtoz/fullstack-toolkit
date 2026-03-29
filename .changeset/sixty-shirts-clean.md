---
"@firtoz/router-toolkit": patch
---

Fix `useConcurrentSubmitter` `submitJson` overload selection: detect no-params routes with `keyof params extends never` so `RegisterPages`’ `AnyPages` fallback is not treated as `{}`, avoiding bogus route-args typing (e.g. numeric JSON fields rejected as non-strings).
