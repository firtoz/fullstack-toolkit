---
"@firtoz/worker-helper": minor
---

Improved workspace-wide type generation and environment setup

- Refactored `cf-typegen.ts` to automatically discover all wrangler configs using `git ls-files`
- Uses git for workspace discovery - fast, respects .gitignore, and finds all tracked configs
- Added `prepareEnvFiles` utility to handle .env file creation from .env.example templates
- Type generation now includes bindings from all workspace projects for better DX
