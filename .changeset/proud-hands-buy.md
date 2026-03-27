---
"@firtoz/db-helpers": patch
---

`receiveSync` now waits for eager `initialSync` to finish before applying messages, preventing duplicate insert errors when remote snapshot backfill races with loading persisted rows into the collection.
