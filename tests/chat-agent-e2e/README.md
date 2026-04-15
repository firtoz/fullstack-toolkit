# ChatAgent E2E Tests

End-to-end tests for `@firtoz/chat-agent` using Bun's test runner with automatic `wrangler dev` lifecycle management.

**Just run `bun test` - everything else is automatic!**

## Why E2E with Bun Instead of Vitest?

The `@cloudflare/vitest-pool-workers` integration has persistent issues with CommonJS/ESM module transformation for certain dependencies (specifically `ajv` used by `@modelcontextprotocol/sdk`). By using Bun's test runner with direct WebSocket connections against a live `wrangler dev` server, we bypass these issues entirely and test the actual production behavior.

Bun provides:
- **Built-in WebSocket client** - Direct connections without browser context
- **Fast test execution** - ~8s for all 6 tests (including server startup)
- **Process management** - `Bun.spawn()` to automatically start/stop wrangler dev
- **Simple setup** - No additional test framework dependencies
- **TypeScript support** - Native TS execution without compilation

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

Required environment variables:
- `OPENROUTER_API_KEY` - Get from https://openrouter.ai/keys
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `AI_GATEWAY_NAME` - Your AI Gateway name
- `AI_GATEWAY_TOKEN` - Your AI Gateway token

2. Install dependencies:

```bash
bun install
```

## Running Tests

Simply run the tests - the server starts and stops automatically:

```bash
# Run all tests (server starts automatically)
bun run test

# Run tests in watch mode
bun run test:watch

# Run specific test file
bun test tests/chat-agent.bun.test.ts

# Run with verbose output
bun test --verbose
```

The tests automatically:
1. Start `wrangler dev` in a subprocess
2. Wait for the server to be ready
3. Run all tests
4. Stop the server when complete

## Test Structure

- `tests/health.bun.test.ts` - Basic health checks and environment validation
- `tests/chat-agent.bun.test.ts` - ChatAgent WebSocket integration tests with real LLM interactions

## WebSocket Tests

The `chat-agent.bun.test.ts` file contains real WebSocket tests that:

1. **Connect via WebSocket** - Establishes WebSocket connection to ChatAgent DO
2. **Send messages** - Sends user messages and receives streaming responses
3. **Retrieve history** - Fetches complete chat history across sessions
4. **Execute tools** - Tests the `get_test_value` tool with real OpenRouter LLM
5. **Separate instances** - Verifies different agent IDs use separate DO instances

**Message Flow Example:**
```
User: "Hello! Please respond with just 'Hi there!'"
Server: messageStart → messageChunk → messageChunk → messageEnd
```

**Tool Call Example:**
```
User: "Please use the get_test_value tool with key 'foo'"
Server: messageStart → toolCall(get_test_value) → messageEnd
Result: { key: 'foo', value: 'test-value-foo', timestamp: 1234567890 }
```

## How It Works

1. Tests automatically start `wrangler dev` using `Bun.spawn()`
2. Wait for server to be ready (health check on port 8787)
3. Tests use Bun's native WebSocket client to connect to `ws://localhost:8787/chat-agent/{agentId}`
4. Worker adds `x-partykit-room` header and routes to the TestChatAgent Durable Object
5. Tests send/receive messages via WebSocket protocol
6. Real OpenRouter API calls are made (using your actual API key)
7. Responses are streamed back through WebSocket
8. Tests complete in ~8 seconds
9. Server automatically stops when tests finish

## CI/CD

In CI environments, the tests will:
- **Skip gracefully** if environment variables are not configured
- Automatically run when the required secrets are set as GitHub secrets:
  - `OPENROUTER_API_KEY`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `AI_GATEWAY_NAME`
  - `AI_GATEWAY_TOKEN`

On pushes to `main`, the release workflow passes these as environment variables to the test runner (via a reusable workflow), and wrangler automatically picks them up.

Pull request CI does **not** inject these repository secrets (including PRs from branches on this repo); integration tests that need them skip with a warning. Fork PRs behave the same way.
