# @firtoz/chat-agent-sql

## 2.0.0

### Minor Changes

- [`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd) Thanks [@firtoz](https://github.com/firtoz)! - Publish compiled ESM and TypeScript declarations from `dist/` for each package (`tsup`, `prepack` build). `exports`, `main`, and `types` resolve to `dist/`; CLI bins point at built JS with a Node shebang where applicable. Shared `scripts/tsup-lib.ts` discovers `src` entries and externals; workspace test apps map `@firtoz/*` to package sources in `tsconfig` for accurate generics during typecheck. `@firtoz/socka` is published under the scoped name with the same `dist/` layout.

### Patch Changes

- [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe) Thanks [@firtoz](https://github.com/firtoz)! - Improve READMEs: npm shields, contextual stack badges, clearer taglines, and new docs for `@firtoz/idb-collections` and `@firtoz/collection-sync`. Align `@firtoz/db-helpers` copy with published `dist/` builds.

- Updated dependencies [[`c3a3cc7`](https://github.com/firtoz/fullstack-toolkit/commit/c3a3cc778ba9ce4b5efe1bcdd8d541f46dec3bfd), [`f78c988`](https://github.com/firtoz/fullstack-toolkit/commit/f78c988d37a9cc48490ee3372dccc14a42810bfe)]:
  - @firtoz/chat-agent@2.1.0

## 1.0.0

### Major Changes

- [`4d936e6`](https://github.com/firtoz/fullstack-toolkit/commit/4d936e6ef9a3eb7eb3ff2477c772125cae4297b9) Thanks [@firtoz](https://github.com/firtoz)! - **Breaking:** Split persistence out of `@firtoz/chat-agent`. The core package now exports only wire types, `defineTool`, and `ChatAgentBase`. Import `DrizzleChatAgent` from `@firtoz/chat-agent-drizzle` and `SqlChatAgent` from `@firtoz/chat-agent-sql`. Schema and migrations moved to `@firtoz/chat-agent-drizzle` (`@firtoz/chat-agent-drizzle/db/schema`); `drizzle-orm` is no longer a peer of core.

  Initial publish of `@firtoz/chat-agent-drizzle` and `@firtoz/chat-agent-sql` at 1.0.0.

  Also in this release: broadcast chat stream and history updates to all WebSocket connections on the same agent; serialize chat turns; batch rapid client `toolResult` + `autoContinue` into one continuation; harden `resumeStream` for unknown ids and orphaned post-hibernation streams; optional `maxPersistedMessages` and `sanitizeMessageForPersistence`; expose `waitUntilStable`, `resetTurnState`, and `hasPendingInteraction`; streaming under `experimental_waitUntil` for DO keep-alive (enable `enable_ctx_exports` in Wrangler); fix Drizzle `dbFindMaxChunkIndex` to use the maximum chunk index; server tool human-in-the-loop (`needsApproval` + `toolApprovalRequest` / `toolApprovalResponse`); regenerate and client history sync via extended `sendMessage` (`trigger`, optional `messages`); optional `providerMetadata` on tool calls; move `zod` to a direct dependency and validate wire messages with Zod 4 (`zod/v4`). Add Bun unit tests for wire schemas and `test` / `test:watch` scripts on core.

### Patch Changes

- Updated dependencies [[`4d936e6`](https://github.com/firtoz/fullstack-toolkit/commit/4d936e6ef9a3eb7eb3ff2477c772125cae4297b9)]:
  - @firtoz/chat-agent@2.0.0
