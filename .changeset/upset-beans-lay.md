---
"@firtoz/chat-agent": minor
---

Broadcast chat stream and history updates to all WebSocket connections on the same agent, serialize chat turns, batch rapid client `toolResult` + `autoContinue` into one continuation, harden `resumeStream` for unknown ids and orphaned post-hibernation streams, add optional `maxPersistedMessages` and `sanitizeMessageForPersistence`, and expose `waitUntilStable`, `resetTurnState`, and `hasPendingInteraction`. Streaming runs under `experimental_waitUntil` for DO keep-alive (enable `enable_ctx_exports` in Wrangler). Fix Drizzle `dbFindMaxChunkIndex` to use the maximum chunk index.

Add server tool human-in-the-loop (`needsApproval` + `toolApprovalRequest` / `toolApprovalResponse`), regenerate and client history sync via extended `sendMessage` (`trigger`, optional `messages`), optional `providerMetadata` on tool calls for provider-specific stream fields, move `zod` to a direct dependency and validate wire messages with Zod 4 (`zod/v4`).
