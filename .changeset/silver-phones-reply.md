---
"@firtoz/collection-sync": minor
"@firtoz/drizzle-durable-sqlite": minor
---

Add a new `@firtoz/collection-sync` package with websocket sync protocol schemas and reusable client/server bridge utilities for optimistic mutation + reconciliation flows.

Add `applyDurableMutationIntents` to `@firtoz/drizzle-durable-sqlite` for applying mutation intent batches and emitting canonical sync change messages from Durable Object collections.
