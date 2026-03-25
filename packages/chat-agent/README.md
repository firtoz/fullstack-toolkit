# @firtoz/chat-agent

Wire protocol (Zod 4), `defineTool`, and abstract **`ChatAgentBase`** for Cloudflare Durable Objects with OpenRouter—a simplified alternative to `@cloudflare/ai-chat`.

**Persistence is separate:** install one of:

- **`@firtoz/chat-agent-drizzle`** — Drizzle ORM (recommended)
- **`@firtoz/chat-agent-sql`** — raw `this.sql`

## Upgrading from v1

v1 shipped `DrizzleChatAgent`, `SqlChatAgent`, and `ChatAgent` (alias) from this package. v2 keeps only protocol + base here.

| v1 | v2 |
|----|-----|
| `import { DrizzleChatAgent, defineTool } from "@firtoz/chat-agent"` | `import { defineTool } from "@firtoz/chat-agent"` and `import { DrizzleChatAgent } from "@firtoz/chat-agent-drizzle"` |
| `import { SqlChatAgent } from "@firtoz/chat-agent"` | `import { SqlChatAgent } from "@firtoz/chat-agent-sql"` |
| `import { … } from "@firtoz/chat-agent/db/schema"` | `import { … } from "@firtoz/chat-agent-drizzle/db/schema"` |
| `import { ChatAgent } from "@firtoz/chat-agent"` (Drizzle alias) | `import { DrizzleChatAgent } from "@firtoz/chat-agent-drizzle"` (or a local `type ChatAgent = DrizzleChatAgent`) |

Add `bun add @firtoz/chat-agent-drizzle` (and `drizzle-orm`) or `bun add @firtoz/chat-agent-sql` as needed.

## Overview

- **`ChatAgentBase`** — Abstract class with chat + streaming + tools + multi-tab broadcast logic
- **Concrete agents** — `DrizzleChatAgent` (`@firtoz/chat-agent-drizzle`), `SqlChatAgent` (`@firtoz/chat-agent-sql`)

Shared behavior (all implementations):

- OpenRouter API integration (simpler than AI SDK)
- Resumable streaming with chunk buffering
- **Multi-tab sync**: `messageStart`, chunks, `messageEnd`, `messageUpdated`, `streamResume`, and post-mutation `history` are **broadcast** to every WebSocket on the same Durable Object (merge by message `id` / `streamId` on the client)
- Serialized chat turns with batched `toolResult` + `autoContinue`
- Server-side and client-side tools
- Cloudflare AI Gateway support
- Optional `maxPersistedMessages` and `sanitizeMessageForPersistence()`
- `waitUntilStable()`, `resetTurnState()`, `hasPendingInteraction()` (subclasses)
- Tool approval (`needsApproval` → `toolApprovalRequest` / `toolApprovalResponse`)
- Regenerate / client sync (`sendMessage` with `trigger`, optional `messages`)
- **Provider metadata** on tool calls for upstream round-trips
- Wire schemas use **Zod 4** (`zod/v4`)

### Long-running streams (Durable Object keep-alive)

Streaming uses Partyserver’s `experimental_waitUntil`. Enable **`enable_ctx_exports`** in `wrangler.jsonc` (required for `experimental_waitUntil` on `Server` / `Agent`).

## Installation

```bash
bun add @firtoz/chat-agent @openrouter/sdk agents
```

For a runnable Durable Object agent, add a persistence package:

```bash
# Drizzle (recommended)
bun add @firtoz/chat-agent-drizzle drizzle-orm
bun add -d drizzle-kit

# Or raw SQL only
bun add @firtoz/chat-agent-sql
```

## Quick start (Drizzle)

```typescript
import { defineTool, type ToolDefinition } from "@firtoz/chat-agent";
import { DrizzleChatAgent } from "@firtoz/chat-agent-drizzle";

interface Env {
  OPENROUTER_API_KEY: string;
}

class MyAgent extends DrizzleChatAgent<Env> {
  protected override getSystemPrompt(): string {
    return "You are a helpful assistant.";
  }

  protected override getModel(): string {
    return "anthropic/claude-sonnet-4.5";
  }

  protected override getTools(): ToolDefinition[] {
    return [
      defineTool({
        name: "get_time",
        description: "Get current time",
        parameters: { type: "object", properties: {} },
        execute: async () => ({ time: new Date().toISOString() }),
      }),
    ];
  }
}

export { MyAgent };
```

See **`@firtoz/chat-agent-drizzle`** for Wrangler rules, migrations, and `drizzle.config.ts`.

## Quick start (SQL)

```typescript
import { defineTool } from "@firtoz/chat-agent";
import { SqlChatAgent } from "@firtoz/chat-agent-sql";

class MyAgent extends SqlChatAgent<Env> {
  // Same overrides as Drizzle; tables are created in dbInitialize()
}
```

## ChatAgentBase (abstract)

Subclasses must implement the database interface (see Drizzle/SQL packages for examples).

### Abstract methods

```typescript
protected abstract dbInitialize(): void;
protected abstract dbLoadMessages(): ChatMessage[];
protected abstract dbSaveMessage(msg: ChatMessage): void;
protected abstract dbClearAll(): void;
protected abstract dbFindActiveStream(): {
  id: string;
  messageId: string;
  createdAt: Date;
} | null;
protected abstract dbDeleteStreamWithChunks(streamId: string): void;
protected abstract dbInsertStreamMetadata(streamId: string, messageId: string): void;
protected abstract dbUpdateStreamStatus(
  streamId: string,
  status: "completed" | "error",
): void;
protected abstract dbDeleteOldCompletedStreams(cutoffMs: number): void;
protected abstract dbFindMaxChunkIndex(streamId: string): number | null;
protected abstract dbInsertChunks(
  chunks: Array<{
    id: string;
    streamId: string;
    content: string;
    chunkIndex: number;
  }>,
): void;
protected abstract dbGetChunks(streamId: string): string[];
protected abstract dbDeleteChunks(streamId: string): void;
protected abstract dbIsStreamKnown(streamId: string): boolean;
protected abstract dbReplaceAllMessages(messages: ChatMessage[]): void;
protected abstract dbTrimMessagesToMax(maxMessages: number): void;
```

### Common overrides

```typescript
protected getSystemPrompt(): string { /* … */ }
protected getModel(): string { /* … */ }
protected getTools(): ToolDefinition[] { /* … */ }
```

## Tools

### Server-side

`defineTool` with `execute` runs on the server; results are merged into the conversation.

### Client-side

Omit `execute`; tool calls are sent to the client over the WebSocket.

## Environment variables

```env
OPENROUTER_API_KEY=sk-or-...
# Optional: Cloudflare AI Gateway
CLOUDFLARE_ACCOUNT_ID=…
AI_GATEWAY_NAME=…
AI_GATEWAY_TOKEN=…
```

## Types (excerpt)

`UserMessage`, `AssistantMessage`, `ToolMessage`, `ToolCall`, `ClientMessage`, `ServerMessage`, etc. are exported from this package—import types from `@firtoz/chat-agent` only.

## Drizzle vs SQL

| | Drizzle | SQL |
|---|--------|-----|
| Package | `@firtoz/chat-agent-drizzle` | `@firtoz/chat-agent-sql` |
| Type safety | Full schema + query builder | Template SQL |
| Setup | Migrations + Wrangler `.sql` rules | Auto-creates tables |
| Best for | New projects | Prototypes / raw SQL |

## License

MIT
