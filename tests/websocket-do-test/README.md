# WebSocket DO Test Suite

Integration tests for `@firtoz/websocket-do` and `@firtoz/chat-agent` packages.

## Structure

```
src/
├── websocket/              # WebSocket DO tests
│   ├── test-fixtures/      # Test DOs and worker
│   └── *.test.ts          # WebSocket tests
└── chat-agent/            # Chat Agent tests
    ├── test-fixtures/      # TestChatAgent
    └── *.test.ts          # Chat agent tests
```

## Setup

### 1. Configure Environment Variables

The test suite uses `.env.local` for environment variables. Run typegen to create it:

```bash
bun run typegen
```

This will:
- Read required vars from `.env.local.example`
- Create `.env.local` if it doesn't exist
- Add any missing env vars (as empty strings)
- Generate TypeScript types from Cloudflare bindings

### 2. Set API Keys (Optional)

Edit `.env.local` to add your API keys for chat agent tests:

```env
OPENROUTER_API_KEY=sk-or-...
```

**Note:** Chat agent tests will be skipped if `OPENROUTER_API_KEY` is not set.

## Running Tests

```bash
# Run all tests
bun test

# Watch mode
bun test:watch

# WebSocket tests only (always run)
bun test src/websocket

# Chat agent tests only (requires OPENROUTER_API_KEY)
bun test src/chat-agent
```

## Test Categories

### WebSocket Tests (`src/websocket/`)

Tests for `@firtoz/websocket-do` package:
- Base WebSocket DO functionality
- Zod-based message validation
- Hibernation simulation
- Session management
- Dynamic protocol switching

**Always run** - no API keys required

### Chat Agent Tests (`src/chat-agent/`)

Tests for `@firtoz/chat-agent` package:
- Configuration verification
- DO binding checks
- Environment setup validation

**Conditionally run** - requires `OPENROUTER_API_KEY` in `.env.local`

**Note:** Full integration tests (instantiating ChatAgent, sending messages, testing tools) require the `cloudflare:email` module which is not yet available in the vitest-pool-workers test environment. These tests currently verify configuration only. For full E2E testing of chat functionality, deploy to a Cloudflare Workers environment and test via HTTP/WebSocket.

## Cloudflare Configuration

### Environment Variables

Environment variables are defined in `.env.local.example` and automatically synced to `.env.local` by `cf-typegen`. This prevents accidentally binding empty vars at runtime in `wrangler.jsonc`.

### Wrangler Config

The `wrangler.jsonc` defines:
- Durable Object bindings
- SQL import rules for Drizzle migrations

### Type Generation

```bash
bun run typegen
```

Generates `worker-configuration.d.ts` with proper TypeScript types for:
- Environment bindings
- Durable Object stubs
- Cloudflare platform types

Uses `worker-helper/cf-typegen` script to ensure `.env.local` is up to date.

## Adding New Tests

1. Create test file in appropriate folder (`websocket/` or `chat-agent/`)
2. Add test fixtures to `test-fixtures/` subdirectory
3. Export DOs from `worker.ts`
4. Add DO binding to `wrangler.jsonc`
5. Run `bun run typegen` to update types
