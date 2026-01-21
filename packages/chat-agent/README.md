# @firtoz/chat-agent

DB-agnostic ChatAgent for Cloudflare Durable Objects with OpenRouter - a simplified alternative to `@cloudflare/ai-chat`.

## Overview

Three classes for different database preferences:

- **`ChatAgentBase`** - Abstract base class with all chat logic
- **`DrizzleChatAgent`** - Type-safe implementation using Drizzle ORM (recommended)
- **`SqlChatAgent`** - Raw SQL implementation using `this.sql` template tags

All implementations share the same API and features:
- OpenRouter API integration (simpler than AI SDK)
- Resumable streaming with chunk buffering
- Server-side and client-side tool execution
- Cloudflare AI Gateway support
- Message persistence in SQLite

## Installation

```bash
bun add @firtoz/chat-agent @openrouter/sdk agents

# For Drizzle implementation:
bun add drizzle-orm
bun add -d drizzle-kit
```

## Quick Start

### Using DrizzleChatAgent (Recommended)

```typescript
import { DrizzleChatAgent, defineTool } from "@firtoz/chat-agent";
import type { AgentContext } from "agents";

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

  protected override getTools() {
    return [
      defineTool({
        name: "get_time",
        description: "Get current time",
        parameters: { type: "object", properties: {} },
        execute: async () => ({ time: new Date().toISOString() })
      })
    ];
  }
}

export { MyAgent };
```

### Using SqlChatAgent

```typescript
import { SqlChatAgent } from "@firtoz/chat-agent";

class MyAgent extends SqlChatAgent<Env> {
  // Same API as DrizzleChatAgent
  protected override getSystemPrompt(): string {
    return "You are a helpful assistant.";
  }
}
```

## Setup Instructions

### DrizzleChatAgent Setup

#### 1. Add Wrangler Rules

**IMPORTANT:** Add this to your `wrangler.jsonc` to import SQL migration files:

```jsonc
{
  /**
   * Rules to import SQL migration files as text
   * Required for Drizzle ORM migrations in Durable Objects
   * @see https://orm.drizzle.team/docs/connect-cloudflare-do
   */
  "rules": [
    {
      "type": "Text",
      "globs": ["**/*.sql"],
      "fallthrough": true
    }
  ]
}
```

#### 2. Create Drizzle Config

Create `drizzle.config.ts` in your package:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./node_modules/@firtoz/chat-agent/src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "durable-sqlite",
});
```

Or if you're in the chat-agent package itself:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "durable-sqlite",
});
```

#### 3. Add Script to package.json

```json
{
  "scripts": {
    "db:generate": "bunx drizzle-kit generate"
  }
}
```

#### 4. Generate Migrations

```bash
bun run db:generate
```

This creates:
- `drizzle/migrations.js` - Runtime migration imports
- `drizzle/0000_*.sql` - Migration SQL files
- `drizzle/meta/` - Journal and snapshots

The migrations are automatically run when `DrizzleChatAgent` initializes.

### SqlChatAgent Setup

No additional setup needed! The SQL version creates tables automatically using `this.sql` template tags in `dbInitialize()`.

## ChatAgentBase (Abstract Class)

The base class handles all chat logic and defines the abstract database interface that implementations must provide.

### Abstract Methods

Subclasses must implement these database operations:

```typescript
// Initialization
protected abstract dbInitialize(): void;

// Messages
protected abstract dbLoadMessages(): ChatMessage[];
protected abstract dbSaveMessage(msg: ChatMessage): void;
protected abstract dbClearAll(): void;

// Stream metadata
protected abstract dbFindActiveStream(): { 
  id: string; 
  messageId: string; 
  createdAt: Date 
} | null;
protected abstract dbDeleteStreamWithChunks(streamId: string): void;
protected abstract dbInsertStreamMetadata(streamId: string, messageId: string): void;
protected abstract dbUpdateStreamStatus(streamId: string, status: 'completed' | 'error'): void;
protected abstract dbDeleteOldCompletedStreams(cutoffMs: number): void;

// Stream chunks
protected abstract dbFindMaxChunkIndex(streamId: string): number | null;
protected abstract dbInsertChunks(chunks: Array<{ 
  id: string; 
  streamId: string; 
  content: string; 
  chunkIndex: number 
}>): void;
protected abstract dbGetChunks(streamId: string): string[];
protected abstract dbDeleteChunks(streamId: string): void;
```

### Override Methods

Customize your agent's behavior:

```typescript
protected getSystemPrompt(): string {
  return "Your custom system prompt";
}

protected getModel(): string {
  // Popular OpenRouter models:
  // - anthropic/claude-opus-4.5 (most capable)
  // - anthropic/claude-sonnet-4.5 (balanced, default)
  // - anthropic/claude-haiku-3.5 (fastest, cheapest)
  return "anthropic/claude-sonnet-4.5";
}

protected getTools(): ToolDefinition[] {
  return [
    // Your tools here
  ];
}
```

## DrizzleChatAgent

Type-safe implementation using Drizzle ORM.

### Database Schema

The package provides three tables:

```typescript
// From @firtoz/chat-agent/db/schema

export const messagesTable = sqliteTable("messages", {
  id: text("id").primaryKey(),
  role: text("role", { enum: ["user", "assistant", "tool"] }).notNull(),
  messageJson: text("message_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const streamChunksTable = sqliteTable("stream_chunks", {
  id: text("id").primaryKey(),
  streamId: text("stream_id").notNull(),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const streamMetadataTable = sqliteTable("stream_metadata", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  status: text("status", { enum: ["streaming", "completed", "error"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});
```

### Implementation Details

```typescript
import { DrizzleChatAgent } from "@firtoz/chat-agent";

// Automatically:
// - Creates Drizzle DB instance in dbInitialize()
// - Runs migrations from drizzle/migrations.js
// - Uses type-safe query builder for all operations
```

## SqlChatAgent

Raw SQL implementation following `@cloudflare/ai-chat` pattern.

### Table Structure

Creates these tables automatically:

```sql
CREATE TABLE IF NOT EXISTS cf_ai_chat_agent_messages (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cf_ai_chat_stream_chunks (
  id TEXT PRIMARY KEY,
  stream_id TEXT NOT NULL,
  body TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cf_ai_chat_stream_metadata (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_stream_chunks_stream_id 
  ON cf_ai_chat_stream_chunks(stream_id, chunk_index);
```

### Implementation Details

```typescript
import { SqlChatAgent } from "@firtoz/chat-agent";

// Uses Agent's built-in this.sql template tag:
// - this.sql`SELECT * FROM table WHERE id = ${id}`
// - No additional dependencies
// - Tables created automatically in dbInitialize()
```

## Tools

### Server-Side Tools

Tools with `execute` function run on the server:

```typescript
defineTool({
  name: "get_weather",
  description: "Get weather for a location",
  parameters: {
    type: "object",
    properties: {
      location: { type: "string" }
    },
    required: ["location"]
  },
  execute: async (args: { location: string }) => {
    // Runs on server, result automatically added to conversation
    const weather = await fetchWeather(args.location);
    return { temperature: weather.temp, condition: weather.condition };
  }
})
```

### Client-Side Tools

Tools without `execute` are sent to client for execution:

```typescript
defineTool({
  name: "get_user_location",
  description: "Get user's browser location",
  parameters: {
    type: "object",
    properties: {}
  }
  // No execute - client handles this via WebSocket
})
```

## Environment Variables

```env
# Required
OPENROUTER_API_KEY=sk-or-...

# Optional: Cloudflare AI Gateway
CLOUDFLARE_ACCOUNT_ID=your-account-id
AI_GATEWAY_NAME=your-gateway-name
AI_GATEWAY_TOKEN=your-gateway-token
```

## API Reference

### ChatMessage

```typescript
type UserMessage = {
  id: string;
  role: "user";
  content: string;
  createdAt: number;
};

type AssistantMessage = {
  id: string;
  role: "assistant";
  content: string | null;
  toolCalls?: ToolCall[];
  createdAt: number;
};

type ToolMessage = {
  id: string;
  role: "tool";
  toolCallId: string;
  content: string;
  createdAt: number;
};
```

### ToolDefinition

```typescript
type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: JSONSchema;
    strict?: boolean;
  };
  execute?: (args: any) => unknown | Promise<unknown>;
};
```

## Features

### Implemented

- ✅ Message persistence (Drizzle or SQL)
- ✅ Resumable streaming with chunk buffering
- ✅ Stream restoration on reconnect
- ✅ Request cancellation via AbortController
- ✅ Server-side and client-side tools
- ✅ Tool result handling with auto-continue
- ✅ Cloudflare AI Gateway support
- ✅ DB-agnostic architecture

### Comparison: Drizzle vs SQL

| Feature | DrizzleChatAgent | SqlChatAgent |
|---------|-----------------|--------------|
| Type Safety | ✅ Full type inference | ❌ Template string types only |
| Setup Complexity | ⚠️ Requires migrations | ✅ Auto-creates tables |
| Dependencies | Drizzle ORM + drizzle-kit | None (uses Agent.sql) |
| Query Builder | ✅ Yes | ❌ Raw SQL only |
| Performance | Same | Same |
| Wrangler Config | ⚠️ Requires rules for .sql | ✅ No special config |
| Recommended For | New projects, teams | Quick prototypes, SQL experts |

## License

MIT

## Contributing

PRs welcome!
