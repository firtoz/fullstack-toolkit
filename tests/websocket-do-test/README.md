# WebSocket Durable Objects Test Suite

This package contains comprehensive integration tests for the `@firtoz/websocket-do` package, demonstrating full WebSocket testing capabilities with Cloudflare Durable Objects.

## What's Tested

### BaseWebSocketDO Tests (9 tests)
- **HTTP Endpoints**: Worker routing and DO HTTP endpoints
- **Durable Object Isolation**: Verify separate DO instances for different IDs
- **WebSocket Connections**: Full WebSocket lifecycle including upgrades
- **Real-time Messaging**: Message broadcasting between multiple clients
- **State Management**: Name changes and session state updates
- **Room Isolation**: Messages don't leak between different DO instances

### honoDoFetcher Tests (8 tests)
- **Type-safe DO Client**: Create clients from DO stubs
- **Named ID Access**: `honoDoFetcherWithName` functionality
- **String ID Access**: `honoDoFetcherWithId` functionality
- **DO Instance Consistency**: Same ID/name routes to same DO
- **DO Isolation**: Different IDs/names create separate DOs
- **Type Safety**: End-to-end type inference for DO endpoints

## Quick Start

```bash
# Install dependencies (from monorepo root)
bun install

# Generate TypeScript types from wrangler.jsonc
bun run typegen

# Run tests
bun run test

# Run tests in watch mode
bun run test:watch

# Type checking
bun run typecheck

# Linting
bun run lint
```

**Note:** These tests use Vitest for testing framework features like `vi.waitFor()`, `describe`, `it`, `expect`, etc. See [Vitest API documentation](https://vitest.dev/api/) for details on test utilities.

## Key Learnings

### 1. DO Binding Configuration

**The most critical lesson:** Do NOT include `script_name` in your Durable Object bindings when testing with `vitest-pool-workers`.

```jsonc
// ❌ WRONG - This fails with "service not defined"
{
  "durable_objects": {
    "bindings": [{
      "name": "CHAT_ROOM",
      "class_name": "ChatRoomDO",
      "script_name": "websocket-do-test"  // ← Remove this!
    }]
  }
}

// ✅ CORRECT - DO must be in the same worker
{
  "durable_objects": {
    "bindings": [{
      "name": "CHAT_ROOM",
      "class_name": "ChatRoomDO"
    }]
  }
}
```

**Source:** [Cloudflare Vitest Integration - Configuration](https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/)

### 2. Using SELF for Integration Testing

The `SELF` import from `cloudflare:test` is a service binding to your Worker's default export.

```typescript
import { SELF } from "cloudflare:test";
import "./test-fixtures/worker"; // Load worker into test env

const response = await SELF.fetch("http://example.com/api");
```

**Key insight:** You must import your worker file to register it with the test environment. Without this import, `SELF` won't know what to route to.

**Source:** [Write Your First Test](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/)

### 3. WebSocket Testing

Unlike `unstable_dev` (which fails with "invalid upgrade header"), `vitest-pool-workers` provides full WebSocket support:

```typescript
const resp = await SELF.fetch("http://example.com/websocket", {
  headers: { Upgrade: "websocket" }
});

// resp.webSocket is available!
const ws = resp.webSocket;
ws.accept(); // Must call accept() before using

ws.send(JSON.stringify({ type: "message", text: "Hello!" }));
ws.addEventListener("message", (event) => {
  console.log("Received:", event.data);
});
```

**Key insights:**
- `response.webSocket` is only available in `vitest-pool-workers`, not `unstable_dev`
- Must call `ws.accept()` before sending/receiving (Cloudflare-specific requirement)
- Use standard WebSocket API after accepting

**Sources:**
- [Migration from unstable_dev](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-from-unstable-dev/)
- [WebSocket API](https://developers.cloudflare.com/workers/runtime-apis/websockets/)

### 4. Durable Object Isolation

DOs are isolated by ID using `getByName()` (2025+ compatibility):

```typescript
// Same name = same DO instance
const stub1 = env.CHAT_ROOM.getByName("room-1");
const stub2 = env.CHAT_ROOM.getByName("room-1");
// Both stubs point to the same DO instance

// Different name = different DO instance
const stub3 = env.CHAT_ROOM.getByName("room-2");
// stub3 points to a different DO instance than stub1/stub2
```

This enables multi-tenant patterns where each room/channel/game gets its own isolated DO instance.

**Source:** [Accessing Durable Objects - Generating IDs by Name](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-from-a-worker/#generating-ids-by-name)

### 5. Environment Bindings Access

For tests that need direct access to environment bindings (like DO namespaces), use the `env` import:

```typescript
import { env } from "cloudflare:test";

// Direct access to DO namespace
const stub = env.CHAT_ROOM.getByName("room-1"); // Using new getByName API

// Use with honoDoFetcher for type-safe DO clients
const api = honoDoFetcher(stub);
```

This is different from `SELF.fetch()` which routes through your Worker. The `env` import gives you direct access to bindings defined in `wrangler.jsonc`.

### 6. Type-safe DO Clients with honoDoFetcher

The `@firtoz/hono-fetcher` package provides type-safe clients for Durable Objects:

```typescript
import { honoDoFetcher, honoDoFetcherWithName } from "@firtoz/hono-fetcher";

// From DO stub
const api = honoDoFetcher(stub);

// From name (creates stub internally)
const api = honoDoFetcherWithName(env.CHAT_ROOM, "room-1");

// Type-safe requests
const response = await api.post({ url: "/info" });
const data = await response.json(); // Fully typed!
```

**Source:** [hono-fetcher package](https://github.com/firtoz/router-toolkit/tree/main/packages/hono-fetcher)

### 7. Type Safety with Generated Types

Running `wrangler types` generates `worker-configuration.d.ts` which includes:
- Environment bindings (e.g., `Env.CHAT_ROOM`)
- Cloudflare-specific APIs
- Request context types

```bash
bun run typegen
```

Then reference it in `tsconfig.json`:
```json
{
  "include": ["src/**/*", "worker-configuration.d.ts"]
}
```

This eliminates the need for `@cloudflare/workers-types` and provides accurate types based on your actual wrangler config.

**Source:** [Wrangler Types Command](https://developers.cloudflare.com/workers/wrangler/commands/#types)

### 6. Vitest Configuration

Use `defineWorkersConfig` instead of regular `defineConfig`:

```typescript
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
      },
    },
  },
});
```

This automatically:
- Loads DO bindings from wrangler config
- Sets up Miniflare-based test environment
- Enables WebSocket support

**Source:** [Vitest Integration - Get Started](https://developers.cloudflare.com/workers/testing/vitest-integration/get-started/)

### 8. Task Dependencies with Turbo

Ensure `typegen` runs before other tasks with proper caching:

```json
{
  "tasks": {
    "typegen": {
      "inputs": [
        "wrangler.jsonc",
        ".env", 
        ".dev.vars",
        "package.json",
        "src/**/*.ts"
      ],
      "outputs": ["worker-configuration.d.ts"]
    },
    "typecheck": { "dependsOn": ["typegen"] },
    "lint": { "dependsOn": ["typegen"] },
    "test": { "dependsOn": ["typegen"] }
  }
}
```

**Why these inputs:**
- `wrangler.jsonc` - DO bindings, environment config
- `.env`, `.dev.vars` - Environment variables that affect types
- `package.json` - Dependencies that might affect generated types
- `src/**/*.ts` - Source files that export DO classes

This enables caching while ensuring types regenerate when any relevant input changes.

**Source:** [Turborepo - Running Tasks](https://turbo.build/repo/docs/crafting-your-repository/running-tasks#defining-tasks)

### 9. Compatibility Date

The `wrangler.jsonc` uses the current compatibility date to ensure access to all the latest Cloudflare Workers features:

```jsonc
{
  "compatibility_date": "2025-10-01"
}
```

**Why this matters:**
- Enables cutting-edge APIs like `ctx.exports` (experimental)
- Includes Node.js process v2 implementation (as of 2025-09-15)
- Provides access to all latest runtime improvements and bug fixes
- Ensures consistent behavior with current production environments

**Source:** [Cloudflare Compatibility Dates](https://developers.cloudflare.com/workers/configuration/compatibility-dates/)

## File Structure

```
tests/websocket-do-test/
├── src/
│   ├── test-fixtures/
│   │   ├── ChatRoomDO.ts      # Example DO implementation
│   │   └── worker.ts           # Test worker routing
│   └── BaseWebSocketDO.integration.test.ts  # Integration tests
├── wrangler.jsonc              # DO bindings & config (with comments!)
├── vitest.config.ts            # Vitest pool workers config
├── tsconfig.json               # Includes worker-configuration.d.ts
├── biome.json                  # Linting config
├── turbo.json                  # Task dependencies
├── package.json                # Test dependencies
├── TESTING.md                  # Detailed testing guide
└── README.md                   # This file
```

## Resources

### Official Documentation
- [Cloudflare Vitest Integration](https://developers.cloudflare.com/workers/testing/vitest-integration/) - Main testing docs
- [Migration from unstable_dev](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-from-unstable-dev/) - Why vitest-pool-workers is better
- [Write Your First Test](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/) - SELF usage patterns
- [Vitest Integration Recipes](https://developers.cloudflare.com/workers/testing/vitest-integration/recipes/) - Common patterns

### API References
- [WebSocket API](https://developers.cloudflare.com/workers/runtime-apis/websockets/) - Cloudflare WebSocket specifics
- [Durable Objects](https://developers.cloudflare.com/durable-objects/) - DO fundamentals
- [Accessing DOs from Workers](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-from-a-worker/) - ID generation patterns
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) - Config schema
- [DO Migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/) - Migration system

### Example Code
- [Workers SDK - DO Examples](https://github.com/cloudflare/workers-sdk/tree/main/fixtures/vitest-pool-workers-examples/durable-objects) - Official examples
- [Direct DO Access Test](https://github.com/cloudflare/workers-sdk/blob/main/fixtures/vitest-pool-workers-examples/durable-objects/test/direct-access.test.ts) - DO testing patterns

## Contributing

When adding new tests:

1. **Use descriptive test names** - Explain what behavior is being verified
2. **Add comments for non-obvious patterns** - Especially timing, type guards, and DO isolation
3. **Include references** - Link to docs explaining why something is done a certain way
4. **Keep test fixtures realistic** - They serve as examples for users

## License

Same as the parent `@firtoz/websocket-do` package.
