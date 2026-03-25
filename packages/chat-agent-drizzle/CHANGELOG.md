# @firtoz/chat-agent-drizzle

## 1.0.0

### Major Changes

- [`4d936e6`](https://github.com/firtoz/fullstack-toolkit/commit/4d936e6ef9a3eb7eb3ff2477c772125cae4297b9) Thanks [@firtoz](https://github.com/firtoz)! - **Breaking:** Split persistence out of `@firtoz/chat-agent`. The core package now exports only wire types, `defineTool`, and `ChatAgentBase`. Import `DrizzleChatAgent` from `@firtoz/chat-agent-drizzle` and `SqlChatAgent` from `@firtoz/chat-agent-sql`. Schema and migrations moved to `@firtoz/chat-agent-drizzle` (`@firtoz/chat-agent-drizzle/db/schema`); `drizzle-orm` is no longer a peer of core.

  Initial publish of `@firtoz/chat-agent-drizzle` and `@firtoz/chat-agent-sql` at 1.0.0.

  Also in this release: broadcast chat stream and history updates to all WebSocket connections on the same agent; serialize chat turns; batch rapid client `toolResult` + `autoContinue` into one continuation; harden `resumeStream` for unknown ids and orphaned post-hibernation streams; optional `maxPersistedMessages` and `sanitizeMessageForPersistence`; expose `waitUntilStable`, `resetTurnState`, and `hasPendingInteraction`; streaming under `experimental_waitUntil` for DO keep-alive (enable `enable_ctx_exports` in Wrangler); fix Drizzle `dbFindMaxChunkIndex` to use the maximum chunk index; server tool human-in-the-loop (`needsApproval` + `toolApprovalRequest` / `toolApprovalResponse`); regenerate and client history sync via extended `sendMessage` (`trigger`, optional `messages`); optional `providerMetadata` on tool calls; move `zod` to a direct dependency and validate wire messages with Zod 4 (`zod/v4`). Add Bun unit tests for wire schemas and `test` / `test:watch` scripts on core.

### Patch Changes

- Updated dependencies [[`4d936e6`](https://github.com/firtoz/fullstack-toolkit/commit/4d936e6ef9a3eb7eb3ff2477c772125cae4297b9)]:
  - @firtoz/chat-agent@2.0.0
