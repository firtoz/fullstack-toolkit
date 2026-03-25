# @firtoz/chat-agent-drizzle

**Drizzle ORM** persistence for **`@firtoz/chat-agent`**. Exports **`DrizzleChatAgent`** and the SQLite schema under **`@firtoz/chat-agent-drizzle/db/schema`**.

## Install

```bash
bun add @firtoz/chat-agent @firtoz/chat-agent-drizzle drizzle-orm
bun add -d drizzle-kit
```

Peer/runtime alignment: use the same major as `@firtoz/chat-agent` (see that package’s peers for `agents`, `@openrouter/sdk`, `@cloudflare/workers-types`).

## Usage

```typescript
import { defineTool } from "@firtoz/chat-agent";
import { DrizzleChatAgent } from "@firtoz/chat-agent-drizzle";

class MyAgent extends DrizzleChatAgent<Env> {
  /* getSystemPrompt, getModel, getTools, … */
}
```

## Wrangler: import SQL migrations

Add to `wrangler.jsonc` so migration `.sql` files are bundled:

```jsonc
{
  "rules": [
    {
      "type": "Text",
      "globs": ["**/*.sql"],
      "fallthrough": true
    }
  ]
}
```

Enable **`enable_ctx_exports`** for Partyserver `experimental_waitUntil` (see `@firtoz/chat-agent` README).

## Drizzle Kit

Point `schema` at this package’s schema (or copy the schema into your app if you fork migrations):

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./node_modules/@firtoz/chat-agent-drizzle/src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "durable-sqlite",
});
```

If you develop inside a workspace package that depends on this library, use a path to your local `node_modules` or vendor the schema.

Run `bunx drizzle-kit generate` to produce migrations; at runtime, `DrizzleChatAgent` runs bundled migrations from this package on `dbInitialize()`.

## Schema export

```typescript
import { messagesTable, streamChunksTable, streamMetadataTable } from "@firtoz/chat-agent-drizzle/db/schema";
```

## License

MIT
