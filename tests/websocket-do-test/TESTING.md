# Testing WebSocket Durable Objects

This document explains the testing strategy and setup for the `@firtoz/websocket-do` package.

## Testing Approach

This package uses **`@cloudflare/vitest-pool-workers`** for comprehensive integration testing, including full WebSocket support. The tests verify:

1. **Worker Routing** - Ensure requests properly route to the correct Durable Object instances
2. **Durable Object Isolation** - Verify that different room IDs create separate DO instances
3. **HTTP Endpoints** - Test custom endpoints added to Durable Objects (like `/info`)
4. **WebSocket Connections** - Full WebSocket lifecycle testing including connections, message exchange, and broadcasting
5. **Real-time Messaging** - Test actual message broadcasting between multiple WebSocket clients
6. **Room Isolation** - Verify that messages don't leak between different room instances

## Key Configuration for WebSocket Testing

### Critical Wrangler Configuration

**Reference:** [Cloudflare Vitest Integration - Configuration](https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/)

The most important lesson learned: **DO NOT include `script_name` in your Durable Object bindings for local testing**.

```jsonc
// wrangler.jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "CHAT_ROOM",
        "class_name": "ChatRoomDO"
        // ⚠️ IMPORTANT: Omit "script_name" for vitest-pool-workers
        // When script_name is present, it tries to find an external service
        // For testing, the DO must be in the same worker
      }
    ]
  }
}
```

**Why this matters:** The `vitest-pool-workers` environment expects Durable Objects to be defined within the same worker module being tested. When you add `script_name`, it treats the DO as an external service and fails with:
```
Worker's binding "CHAT_ROOM" refers to a service "websocket-do-test", but no such service is defined.
```

### Vitest Configuration

**Reference:** [Cloudflare Vitest Integration - Get Started](https://developers.cloudflare.com/workers/testing/vitest-integration/get-started/)

```typescript
// vitest.config.ts
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

**Key points:**
- Use `defineWorkersConfig` instead of regular `defineConfig`
- The `wrangler.configPath` must point to your wrangler configuration file
- This integration uses Miniflare under the hood, which has proper WebSocket support

### Test Setup with SELF

**Reference:** [Cloudflare Vitest Integration - Write Your First Test](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/)

The `SELF` import from `cloudflare:test` is the key to testing your Worker:

```typescript
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// IMPORTANT: Import your worker to load it into the test environment
// This ensures the Worker and DO classes are available to SELF
import "./test-fixtures/worker";

it("should establish WebSocket connection", async () => {
  // SELF.fetch() routes to your Worker's default export
  const resp = await SELF.fetch("http://example.com/room/test/websocket", {
    headers: { Upgrade: "websocket" }
  });

  expect(resp.status).toBe(101);
  expect(resp.webSocket).toBeDefined();
});
```

**Why this works:**
- `SELF` is a service binding to your Worker's default export
- When you import your worker file, it registers with the test environment
- The `response.webSocket` property is available when using `vitest-pool-workers`, unlike `unstable_dev`

### Working with WebSocket Connections

**Reference:** [Cloudflare Workers - WebSocket API](https://developers.cloudflare.com/workers/runtime-apis/websockets/)

Once you have a WebSocket from `response.webSocket`, you need to accept it:

```typescript
// Get the WebSocket from the response
if (!resp.webSocket) throw new Error("Expected WebSocket");
const ws = resp.webSocket;

// IMPORTANT: Must call accept() before sending/receiving
// This is required by Cloudflare's WebSocket API
ws.accept();

// Now you can use the standard WebSocket API
ws.send(JSON.stringify({ type: "message", text: "Hello!" }));

ws.addEventListener("message", (event) => {
  const data = JSON.parse(event.data as string);
  console.log("Received:", data);
});
```

**Type safety note:** Use proper type guards instead of non-null assertions for production code:
```typescript
if (!resp.webSocket) throw new Error("Expected WebSocket");
const ws = resp.webSocket; // Type: WebSocket (no ! needed)
```

## Test Structure

### Test Fixtures (`src/test-fixtures/`)

The test fixtures provide a complete example implementation:

- **`ChatRoomDO.ts`** - Example Durable Object with:
  - Chat message broadcasting
  - User name management
  - Session tracking
  - Custom `/info` endpoint

- **`worker.ts`** - Test worker that:
  - Routes requests to Durable Objects by room ID
  - Handles URL path transformation
  - Provides a basic health check endpoint
  - **Exports the DO class** (critical for binding to work)

### Integration Tests

The `src/BaseWebSocketDO.integration.test.ts` file contains comprehensive integration tests:

**HTTP Endpoint Tests:**
- Basic worker functionality
- Durable Object routing and isolation
- Custom HTTP endpoints on DOs

**WebSocket Tests:**
- Connection establishment (status 101)
- Message broadcasting between clients
- Name changes and state updates
- Cross-room message isolation

## Migration from unstable_dev

**Reference:** [Migration Guide from unstable_dev](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-from-unstable-dev/)

The `unstable_dev` API has a fundamental limitation where its underlying HTTP client (undici) rejects WebSocket upgrade headers before they reach the worker. This is not a configuration issue - it's a limitation of the API itself.

**Key differences:**

| Feature | `unstable_dev` | `vitest-pool-workers` |
|---------|----------------|------------------------|
| HTTP Endpoints | ✅ Works | ✅ Works |
| WebSocket Upgrade | ❌ Fails with "invalid upgrade header" | ✅ Works |
| DO Bindings | ✅ Works with manual setup | ✅ Works via wrangler.jsonc |
| Environment Variables | Manual configuration | Automatic from wrangler.jsonc |
| Multiple Workers | Complex setup | Built-in support |

## Running Tests

```bash
# Run tests once
bun test

# Run tests in watch mode
bun test:watch

# Run type checking (with generated types)
bun typecheck

# Generate Worker types from wrangler.jsonc
bun typegen

# Lint code
bun lint
```

## Type Generation

**Reference:** [Wrangler Types Generation](https://developers.cloudflare.com/workers/wrangler/commands/#types)

The `wrangler types` command generates TypeScript definitions for your Worker environment:

```bash
# Generates worker-configuration.d.ts
bun typegen
```

This file includes:
- Environment bindings (like `Env.CHAT_ROOM`)
- Request context types
- Cloudflare-specific APIs

**Important:** Add to your `tsconfig.json`:
```json
{
  "include": ["src/**/*", "worker-configuration.d.ts"]
}
```

## Task Dependencies

**Reference:** [Turborepo Task Dependencies](https://turbo.build/repo/docs/crafting-your-repository/running-tasks#defining-tasks)

The `turbo.json` ensures type generation runs before type checking and linting:

```json
{
  "tasks": {
    "typegen": {
      "cache": false,
      "outputs": ["worker-configuration.d.ts"]
    },
    "typecheck": {
      "dependsOn": ["typegen"]
    },
    "lint": {
      "dependsOn": ["typegen"]
    },
    "test": {
      "dependsOn": ["typegen"]
    }
  }
}
```

**Why this matters:** Without generated types, TypeScript cannot properly type-check your environment bindings, leading to compilation errors.

## Common Patterns

### Testing Message Broadcasting

```typescript
it("should broadcast messages to all clients", async () => {
  // Connect multiple clients
  const ws1 = (await connectWebSocket(roomId)).webSocket!;
  const ws2 = (await connectWebSocket(roomId)).webSocket!;
  ws1.accept();
  ws2.accept();

  // Set up message listener
  const messages: ServerMessage[] = [];
  ws2.addEventListener("message", (event) => {
    messages.push(JSON.parse(event.data as string) as ServerMessage);
  });

  // Allow connection to establish
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Send from one client
  ws1.send(JSON.stringify({ type: "message", text: "Hello!" }));

  // Wait for broadcast
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Verify the other client received it
  expect(messages.length).toBeGreaterThan(0);
  
  // Clean up
  ws1.close();
  ws2.close();
});
```

**Note:** The timing delays (`setTimeout`) are necessary because:
1. WebSocket connections need time to register with the Durable Object
2. Message broadcasting is asynchronous
3. Event listeners need time to receive and process messages

### Testing Room Isolation

```typescript
it("should isolate different room instances", async () => {
  const room1Ws = await connectWebSocket("room-1");
  const room2Ws = await connectWebSocket("room-2");

  // Messages sent in room-1 should NOT appear in room-2
  // This verifies that each room gets its own DO instance
});
```

## Configuration Files

- **`wrangler.jsonc`** - Wrangler configuration with DO bindings (includes JSON schema for IDE support)
- **`vitest.config.ts`** - Vitest configuration using `defineWorkersConfig`
- **`tsconfig.json`** - TypeScript configuration including generated `worker-configuration.d.ts`
- **`biome.json`** - Linting configuration (ignores generated files)
- **`turbo.json`** - Task dependencies ensuring proper build order

## Resources

### Essential Documentation
- [Cloudflare Vitest Integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [Migration from unstable_dev](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-from-unstable-dev/)
- [Vitest Integration Recipes](https://developers.cloudflare.com/workers/testing/vitest-integration/recipes/)

### Example Code
- [Cloudflare Workers SDK - Durable Objects Examples](https://github.com/cloudflare/workers-sdk/tree/main/fixtures/vitest-pool-workers-examples/durable-objects)
- [Direct DO Access Example](https://github.com/cloudflare/workers-sdk/blob/main/fixtures/vitest-pool-workers-examples/durable-objects/test/direct-access.test.ts)

### API References
- [WebSocket API](https://developers.cloudflare.com/workers/runtime-apis/websockets/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Wrangler Commands](https://developers.cloudflare.com/workers/wrangler/commands/)
