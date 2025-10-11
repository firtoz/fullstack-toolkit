# @firtoz/websocket-do

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fwebsocket-do.svg)](https://www.npmjs.com/package/@firtoz/websocket-do)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fwebsocket-do.svg)](https://www.npmjs.com/package/@firtoz/websocket-do)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fwebsocket-do.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

Type-safe WebSocket session management for Cloudflare Durable Objects with Hono integration.

## Features

- 🔒 **Type-safe** - Full TypeScript support with generic types for messages and session data
- ✨ **Zod Validation** - Runtime message validation with `ZodWebSocketClient` and `ZodSession`
- 🌐 **WebSocket Management** - Built on Cloudflare Durable Objects for stateful WebSocket connections
- 🎯 **Session-based** - Abstract session class for easy implementation of custom WebSocket logic
- 🔄 **State Persistence** - Automatic serialization/deserialization of session data
- 📡 **Broadcasting** - Built-in support for broadcasting messages to all connected clients
- 📦 **Buffer Mode** - Efficient binary messaging with msgpack serialization
- 🚀 **Hono Integration** - Seamless integration with Hono framework for routing
- 🔗 **DO Client Integration** - Works seamlessly with `@firtoz/hono-fetcher` for type-safe DO communication

## Installation

```bash
bun add @firtoz/websocket-do
```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
bun add hono @firtoz/hono-fetcher
```

**For Zod validation features** (ZodWebSocketClient, ZodSession):
```bash
bun add zod msgpackr
```

For TypeScript support, use `wrangler types` to generate accurate types from your `wrangler.jsonc`:

```bash
wrangler types
```

This generates `worker-configuration.d.ts` with types for your specific environment bindings, replacing the need for `@cloudflare/workers-types`.

## Quick Start

### 1. Define Your Message Types

```typescript
type ServerMessage = 
  | { type: 'welcome'; userId: string }
  | { type: 'chat'; message: string; from: string };

type ClientMessage = 
  | { type: 'chat'; message: string }
  | { type: 'ping' };

interface SessionData {
  userId: string;
  joinedAt: number;
}
```

### 2. Implement Your Session

```typescript
import { BaseSession } from '@firtoz/websocket-do';
import type { Context } from 'hono';

class ChatSession extends BaseSession<
  Env,
  SessionData,
  ServerMessage,
  ClientMessage
> {
  protected createData(ctx: Context<{ Bindings: Env }>): SessionData {
    return {
      userId: crypto.randomUUID(),
      joinedAt: Date.now(),
    };
  }

  async handleMessage(message: ClientMessage): Promise<void> {
    switch (message.type) {
      case 'chat':
        // Broadcast to all sessions
        this.broadcast({
          type: 'chat',
          message: message.message,
          from: this.data.userId,
        });
        break;
      case 'ping':
        this.send({ type: 'welcome', userId: this.data.userId });
        break;
    }
  }

  async handleBufferMessage(message: ArrayBuffer): Promise<void> {
    // Handle binary messages if needed
  }

  async handleClose(): Promise<void> {
    console.log(`Session closed for user ${this.data.userId}`);
  }
}
```

### 3. Implement Your Durable Object

```typescript
import { BaseWebSocketDO } from '@firtoz/websocket-do';
import { Hono } from 'hono';

export class ChatRoomDO extends BaseWebSocketDO<Env, ChatSession> {
  app = this.getBaseApp()
    .get('/info', (ctx) => {
      return ctx.json({
        connectedUsers: this.sessions.size,
      });
    });

  protected createSession(websocket: WebSocket): ChatSession {
    return new ChatSession(websocket, this.sessions);
  }
}
```

### 4. Configure Your Worker

```jsonc
// wrangler.jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "CHAT_ROOM",
        "class_name": "ChatRoomDO"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["ChatRoomDO"]
    }
  ]
}
```

### 5. Access from Your Worker

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/chat') {
      // Use getByName() for deterministic DO routing (2025+ compatibility)
      const stub = env.CHAT_ROOM.getByName('global-chat');
      
      // Proxy to the Durable Object
      return stub.fetch(request);
    }
    
    return new Response('Not found', { status: 404 });
  }
};
```

## ZodWebSocketClient (Type-Safe Client)

`ZodWebSocketClient` provides a type-safe WebSocket client with automatic Zod validation for both incoming and outgoing messages.

### Features

- ✅ **Automatic validation** - All messages validated with Zod schemas
- 🎯 **Full type inference** - TypeScript types automatically inferred from schemas
- 📦 **Dual mode** - Supports both JSON and msgpack (buffer) serialization
- 🔗 **DO Integration** - Works seamlessly with `honoDoFetcher` WebSocket connections
- 🛡️ **Error handling** - Validation errors caught and reported via callbacks

### Basic Usage

```typescript
import { ZodWebSocketClient } from '@firtoz/websocket-do';
import { z } from 'zod';

// Define your message schemas
const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chat'), text: z.string() }),
  z.object({ type: z.literal('ping') }),
]);

const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chat'), text: z.string(), from: z.string() }),
  z.object({ type: z.literal('pong') }),
]);

type ClientMessage = z.infer<typeof ClientMessageSchema>;
type ServerMessage = z.infer<typeof ServerMessageSchema>;

// Create WebSocket connection (regular or via honoDoFetcher)
const ws = new WebSocket('wss://example.com/chat');

// Wrap with ZodWebSocketClient
const client = new ZodWebSocketClient({
  webSocket: ws, // Can also use 'url' instead
  clientSchema: ClientMessageSchema,
  serverSchema: ServerMessageSchema,
  onMessage: (message) => {
    // Fully typed and validated!
    if (message.type === 'chat') {
      console.log(`${message.from}: ${message.text}`);
    }
  },
});

// Send type-safe messages (automatically validated!)
client.send({ type: 'chat', text: 'Hello!' });
```

### Integration with honoDoFetcher

Perfect for connecting to Durable Objects:

```typescript
import { honoDoFetcherWithName } from '@firtoz/hono-fetcher';
import { ZodWebSocketClient } from '@firtoz/websocket-do';

// 1. Connect to DO via honoDoFetcher
const api = honoDoFetcherWithName(env.CHAT_ROOM, 'room-1');
const wsResp = await api.websocket({
  url: '/websocket',
  config: { autoAccept: false }, // Let client control acceptance
});

// 2. Wrap with ZodWebSocketClient for type safety!
const client = new ZodWebSocketClient({
  webSocket: wsResp.webSocket,
  clientSchema: ClientMessageSchema,
  serverSchema: ServerMessageSchema,
  onMessage: (message) => {
    // Fully typed and validated
    console.log('Received:', message);
  },
  onValidationError: (error) => {
    console.error('Invalid message:', error);
  },
});

// 3. Accept the WebSocket
wsResp.webSocket?.accept();

// 4. Send validated messages
client.send({ type: 'chat', text: 'Hello from typed client!' });
```

### Buffer Mode (msgpack)

For better performance and smaller payloads, use buffer mode with msgpack:

```typescript
const client = new ZodWebSocketClient({
  webSocket: ws,
  clientSchema: ClientMessageSchema,
  serverSchema: ServerMessageSchema,
  enableBufferMessages: true, // Enable msgpack serialization
  onMessage: (message) => {
    // Still fully typed!
    console.log('Received via msgpack:', message);
  },
});

// Messages automatically serialized with msgpack
client.send({ type: 'chat', text: 'Efficient binary message!' });
```

### API Reference

#### Constructor Options

```typescript
interface ZodWebSocketClientOptions<TClientMessage, TServerMessage> {
  // Connection (provide one)
  url?: string;                    // Create new WebSocket
  webSocket?: WebSocket;           // Use existing WebSocket (e.g., from honoDoFetcher)
  
  // Schemas (required)
  clientSchema: z.ZodType<TClientMessage>;
  serverSchema: z.ZodType<TServerMessage>;
  
  // Serialization
  enableBufferMessages?: boolean;  // Use msgpack instead of JSON (default: false)
  
  // Callbacks
  onMessage: (message: TServerMessage) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onValidationError?: (error: unknown) => void;
}
```

#### Methods

- `send(message: TClientMessage): void` - Send a validated message
- `close(code?: number, reason?: string): void` - Close the connection
- `waitForOpen(): Promise<void>` - Wait for connection to open

## ZodSession (Validated Sessions)

`ZodSession` extends `BaseSession` with automatic Zod validation for incoming messages.

### Basic Usage

```typescript
import { ZodSession } from '@firtoz/websocket-do';
import { z } from 'zod';

// Define schemas
const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setName'), name: z.string().min(1).max(50) }),
  z.object({ type: z.literal('message'), text: z.string().max(1000) }),
]);

const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('nameChanged'), newName: z.string() }),
  z.object({ type: z.literal('message'), text: z.string(), from: z.string() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

type ClientMessage = z.infer<typeof ClientMessageSchema>;
type ServerMessage = z.infer<typeof ServerMessageSchema>;

interface SessionData {
  name: string;
}

// Implement validated session
class ChatSession extends ZodSession<
  Env,
  SessionData,
  ServerMessage,
  ClientMessage
> {
  protected clientSchema = ClientMessageSchema;
  protected serverSchema = ServerMessageSchema;

  protected createData(ctx: Context<{ Bindings: Env }>): SessionData {
    return { name: 'Anonymous' };
  }

  async handleMessage(message: ClientMessage): Promise<void> {
    // Message is already validated!
    switch (message.type) {
      case 'setName':
        this.data.name = message.name;
        this.update();
        this.send({ type: 'nameChanged', newName: message.name });
        break;
      
      case 'message':
        this.broadcast({
          type: 'message',
          text: message.text,
          from: this.data.name,
        });
        break;
    }
  }

  async handleClose(): Promise<void> {
    console.log(`${this.data.name} disconnected`);
  }
}
```

### Buffer Mode with ZodSession

```typescript
class ChatSession extends ZodSession<...> {
  // Enable buffer mode for msgpack
  protected enableBufferMessages = true;
  
  protected clientSchema = ClientMessageSchema;
  protected serverSchema = ServerMessageSchema;
  
  // Messages automatically decoded from msgpack
  async handleMessage(message: ClientMessage): Promise<void> {
    // Handle validated message
  }
}
```

## API Reference

### `BaseWebSocketDO<TEnv, TSession>`

Abstract class for creating WebSocket-enabled Durable Objects.

#### Type Parameters

- `TEnv` - Your Cloudflare Worker environment bindings
- `TSession` - Your session class extending `BaseSession`

#### Methods

- `abstract createSession(websocket: WebSocket): TSession | Promise<TSession>`
  - Factory method to create session instances

- `getBaseApp(): Hono`
  - Returns a base Hono app with `/websocket` endpoint configured

- `handleSession(ctx: Context, ws: WebSocket): Promise<void>`
  - Handles new WebSocket connections

#### Properties

- `sessions: Map<WebSocket, TSession>` - Map of all active sessions
- `app: Hono` - Your Hono application (must be implemented)

### `BaseSession<TEnv, TData, TServerMessage, TClientMessage>`

Abstract class for managing individual WebSocket sessions.

#### Type Parameters

- `TEnv` - Your Cloudflare Worker environment bindings
- `TData` - Type of data stored in the session
- `TServerMessage` - Union type of messages sent to clients
- `TClientMessage` - Union type of messages received from clients

#### Methods

- `abstract createData(ctx: Context): TData`
  - Creates initial session data

- `abstract handleMessage(message: TClientMessage): Promise<void>`
  - Handles text messages from client

- `abstract handleBufferMessage(message: ArrayBuffer): Promise<void>`
  - Handles binary messages from client

- `abstract handleClose(): Promise<void>`
  - Cleanup when session closes

- `protected send(message: TServerMessage): void`
  - Send message to this session's client

- `protected broadcast(message: TServerMessage, excludeSelf?: boolean): void`
  - Send message to all connected sessions

- `startFresh(ctx: Context): void`
  - Initialize new session (called automatically)

- `resume(): void`
  - Resume existing session after hibernation (called automatically)

- `update(): void`
  - Manually update serialized session data

#### Properties

- `data: TData` - Current session data
- `websocket: WebSocket` - The underlying WebSocket

### `WebsocketWrapper<TAttachment, TMessage>`

Low-level wrapper for typed WebSocket operations.

#### Methods

- `send(message: TMessage): void`
  - Send JSON-serialized message

- `deserializeAttachment(): TAttachment`
  - Get attached session data

- `serializeAttachment(attachment: TAttachment): void`
  - Update attached session data

## Advanced Usage

### Custom Routes

You can extend the base app with custom routes:

```typescript
export class ChatRoomDO extends BaseWebSocketDO<Env, ChatSession> {
  app = this.getBaseApp()
    .get('/stats', (ctx) => {
      const users = Array.from(this.sessions.values()).map(s => ({
        userId: s.data.userId,
        joinedAt: s.data.joinedAt,
      }));
      
      return ctx.json({ users, count: users.length });
    })
    .post('/broadcast', async (ctx) => {
      const { message } = await ctx.req.json();
      
      for (const session of this.sessions.values()) {
        session.send({ type: 'admin', message });
      }
      
      return ctx.json({ success: true });
    });
}
```

### State Persistence

Session data is automatically serialized and persists across hibernation:

```typescript
class GameSession extends BaseSession<Env, GameData, ServerMsg, ClientMsg> {
  protected createData(ctx: Context): GameData {
    return {
      playerName: ctx.req.query('name') || 'Anonymous',
      score: 0,
      inventory: [],
    };
  }

  async handleMessage(message: ClientMsg): Promise<void> {
    if (message.type === 'collectItem') {
      this.data.inventory.push(message.item);
      this.data.score += 10;
      
      // Persist changes
      this.update();
      
      this.send({ type: 'scoreUpdate', score: this.data.score });
    }
  }
}
```

### Error Handling

Errors in message handlers are caught and logged, but don't crash the connection:

```typescript
async handleMessage(message: ClientMessage): Promise<void> {
  try {
    // Your logic here
    if (message.type === 'dangerous') {
      throw new Error('Invalid operation');
    }
  } catch (error) {
    // Send error to client
    this.send({ 
      type: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    // Optionally close the connection
    this.websocket.close(1008, 'Policy violation');
  }
}
```

## Exports

This package exports the following:

### Classes
- `BaseWebSocketDO` - Abstract base class for WebSocket Durable Objects
- `BaseSession` - Abstract base class for WebSocket sessions
- `ZodWebSocketClient` - Type-safe WebSocket client with Zod validation
- `ZodSession` - Session base class with Zod validation built-in
- `WebsocketWrapper` - Low-level WebSocket wrapper with typed attachments

### Utilities
- `zodMsgpack` - Msgpack encode/decode with Zod validation

### Types
All classes export their type parameters and interfaces for custom implementations.

## Complete Example

Here's a full example combining all features:

```typescript
// schemas.ts
import { z } from 'zod';

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setName'), name: z.string().min(1).max(50) }),
  z.object({ type: z.literal('message'), text: z.string().max(1000) }),
]);

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('nameChanged'), newName: z.string() }),
  z.object({ type: z.literal('message'), text: z.string(), from: z.string() }),
  z.object({ type: z.literal('userJoined'), name: z.string() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

// do.ts - Server-side (Durable Object)
import { BaseWebSocketDO, ZodSession } from '@firtoz/websocket-do';
import { ClientMessageSchema, ServerMessageSchema } from './schemas';

interface SessionData {
  name: string;
  joinedAt: number;
}

class ChatSession extends ZodSession<Env, SessionData, ServerMessage, ClientMessage> {
  protected clientSchema = ClientMessageSchema;
  protected serverSchema = ServerMessageSchema;
  protected enableBufferMessages = true; // Use msgpack for efficiency

  protected createData(): SessionData {
    return {
      name: 'Anonymous',
      joinedAt: Date.now(),
    };
  }

  async handleMessage(message: ClientMessage): Promise<void> {
    switch (message.type) {
      case 'setName':
        const oldName = this.data.name;
        this.data.name = message.name;
        this.update();
        
        this.send({ type: 'nameChanged', newName: message.name });
        this.broadcast({ type: 'userJoined', name: message.name }, true);
        break;
      
      case 'message':
        this.broadcast({
          type: 'message',
          text: message.text,
          from: this.data.name,
        });
        break;
    }
  }

  async handleClose(): Promise<void> {
    console.log(`${this.data.name} disconnected`);
  }
}

export class ChatRoomDO extends BaseWebSocketDO<Env, ChatSession> {
  app = this.getBaseApp()
    .get('/info', (ctx) => {
      const users = Array.from(this.sessions.values()).map(s => ({
        name: s.data.name,
        joinedAt: s.data.joinedAt,
      }));
      return ctx.json({ users, count: users.length });
    });

  protected createSession(websocket: WebSocket): ChatSession {
    return new ChatSession(websocket, this.sessions);
  }
}

// client.ts - Client-side
import { ZodWebSocketClient } from '@firtoz/websocket-do';
import { honoDoFetcherWithName } from '@firtoz/hono-fetcher';
import { ClientMessageSchema, ServerMessageSchema } from './schemas';

async function connectToChat(env: Env, roomName: string) {
  // 1. Connect via honoDoFetcher
  const api = honoDoFetcherWithName(env.CHAT_ROOM, roomName);
  const wsResp = await api.websocket({
    url: '/websocket',
    config: { autoAccept: false },
  });

  // 2. Wrap with ZodWebSocketClient
  const client = new ZodWebSocketClient({
    webSocket: wsResp.webSocket,
    clientSchema: ClientMessageSchema,
    serverSchema: ServerMessageSchema,
    enableBufferMessages: true, // Match server setting
    onMessage: (message) => {
      switch (message.type) {
        case 'message':
          console.log(`${message.from}: ${message.text}`);
          break;
        case 'userJoined':
          console.log(`${message.name} joined!`);
          break;
        case 'nameChanged':
          console.log(`Name changed to ${message.newName}`);
          break;
        case 'error':
          console.error('Error:', message.message);
          break;
      }
    },
    onValidationError: (error) => {
      console.error('Validation error:', error);
    },
  });

  // 3. Accept connection
  wsResp.webSocket?.accept();

  // 4. Use type-safe client
  client.send({ type: 'setName', name: 'Alice' });
  client.send({ type: 'message', text: 'Hello everyone!' });

  return client;
}
```

## Testing

This package includes comprehensive integration tests in a separate test package using `@cloudflare/vitest-pool-workers`, which provides full WebSocket testing capabilities in a Miniflare-based environment that closely mirrors production.

**What can be tested:**
- ✅ Worker routing to Durable Objects
- ✅ HTTP endpoints on DOs  
- ✅ DO state management and isolation
- ✅ Full WebSocket connection lifecycle
- ✅ Real-time WebSocket message exchange
- ✅ WebSocket session management
- ✅ Type-safe DO client integration
- ✅ Zod validation in both JSON and msgpack modes
- ✅ Integration between honoDoFetcher and ZodWebSocketClient

For detailed information about testing capabilities, example implementations, comprehensive test coverage, and setup instructions, see the [websocket-do-test](../../tests/websocket-do-test/) package.

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details on how to contribute to this package.

