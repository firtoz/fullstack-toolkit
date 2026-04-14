---
"@firtoz/websocket-do": major
"@firtoz/drizzle-durable-sqlite": major
---

**@firtoz/websocket-do:** `BaseSessionHandlers.handleClose` and `StandardSchemaSessionHandlers.handleClose` receive the session instance (aligned with DO teardown).

**@firtoz/drizzle-durable-sqlite:** `handleClose` handlers on bundled DO session wiring match the session-aware `BaseSession` contract.
