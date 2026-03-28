---
"@firtoz/db-helpers": patch
"@firtoz/idb-collections": patch
---

`receiveSync` now persists inserts, updates, deletes, and truncates through the sync backend (e.g. IndexedDB) in message order, not only the in-memory TanStack store. Key-val collections pass `getSyncPersistKey` from `getKey` for update persistence.
