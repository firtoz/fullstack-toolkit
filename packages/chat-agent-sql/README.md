# @firtoz/chat-agent-sql

**Raw SQL** persistence for **`@firtoz/chat-agent`** using the Agent **`this.sql`** template tag. Exports **`SqlChatAgent`**.

## Install

```bash
bun add @firtoz/chat-agent @firtoz/chat-agent-sql
```

No Drizzle or migration files: tables are created in `dbInitialize()`.

## Usage

```typescript
import { defineTool } from "@firtoz/chat-agent";
import { SqlChatAgent } from "@firtoz/chat-agent-sql";

class MyAgent extends SqlChatAgent<Env> {
  /* getSystemPrompt, getModel, getTools, … */
}
```

## When to use

Prefer **`@firtoz/chat-agent-drizzle`** for typed queries and versioned migrations. Use this package for minimal dependencies or full control over SQL.

## License

MIT
