# @firtoz/chat-agent-sql

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fchat-agent-sql.svg)](https://www.npmjs.com/package/@firtoz/chat-agent-sql)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fchat-agent-sql.svg)](https://www.npmjs.com/package/@firtoz/chat-agent-sql)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fchat-agent-sql.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Durable_Objects-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/durable-objects/)
[![SQL](https://img.shields.io/badge/Agent-SQLite-0ea5e9)](https://developers.cloudflare.com/agents/)

**Raw `this.sql` persistence for `@firtoz/chat-agent`** — `SqlChatAgent` with no Drizzle; tables created in `dbInitialize()`.

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
