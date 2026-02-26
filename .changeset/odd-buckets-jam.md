---
"@firtoz/worker-helper": minor
---

cf-typegen now discovers wrangler configs from the npm/bun workspace definition (root package.json `workspaces` field) instead of using `git ls-files`. Untracked workspace packages (e.g. new durable objects like fal-user-do) are included in type generation without needing to be committed first.
