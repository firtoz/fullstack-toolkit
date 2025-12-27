---
"@firtoz/drizzle-indexeddb": minor
---

Slight refactor

- Renamed `createProxyDbCreator` to `createProxyIDbCreator` for consistency across the codebase.
- Updated server sync message type from `sync:clear` to `sync:truncate` to better reflect its functionality.
- Adjusted related documentation and test cases to align with these changes.