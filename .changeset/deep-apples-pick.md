---
"@firtoz/socka": patch
---

Unify the **npm** story on **`@firtoz/socka`**: clarify *Socka* (product) vs scoped package in README/docs/changelog, add root **`exports["."]`** plus **`main`**/**`types`** pointing at compiled **`dist/`** (same entry as **`/core`**), extend **`description`** for all supported runtimes, stop shipping **`src/`** in the published tarball (consumers resolve **ESM + `.d.ts`** only), and align peers copy with the scoped name.
