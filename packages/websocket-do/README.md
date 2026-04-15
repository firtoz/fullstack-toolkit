# @firtoz/websocket-do

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fwebsocket-do.svg)](https://www.npmjs.com/package/@firtoz/websocket-do)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fwebsocket-do.svg)](https://www.npmjs.com/package/@firtoz/websocket-do)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fwebsocket-do.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Durable_Objects-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/durable-objects/)
[![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)](https://hono.dev)

**WebSocket sessions on Durable Objects** — Standard Schema message validation, broadcasting, and Hono integration.

> **⚠️ Early WIP Notice:** This package is in very early development and is **not production-ready**. It is TypeScript-only and may have breaking changes. While I (the maintainer) have limited time, I'm open to PRs for features, bug fixes, or additional support (like JS builds). Please feel free to try it out and contribute! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

## Features

- 🔒 **Type-safe** - Full TypeScript support with generic types for messages and session data
- ✨ **Standard Schema validation** - Runtime message validation with `StandardSchemaWebSocketClient` and `StandardSchemaSession` (Zod, Valibot, ArkType, …)
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

**For schemas:** use any [Standard Schema v1](https://standardschema.dev/) library (e.g. Zod, Valibot). **`msgpackr`** is a normal dependency of this package (buffer / msgpack mode); you do not add it separately unless your bundler needs it hoisted.

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
import { BaseSession, type BaseSessionHandlers } from '@firtoz/websocket-do';
import type { Context } from 'hono';

// Define handlers for your session
const chatSessionHandlers: BaseSessionHandlers<
  SessionData,
  ServerMessage,
  ClientMessage,
  Env
> = {
  createData: (ctx: Context<{ Bindings: Env }>) => ({
    userId: crypto.randomUUID(),
    joinedAt: Date.now(),
  }),

  handleMessage: async (message: ClientMessage) => {
    // 'this' context will be the session instance
    switch (message.type) {
      case 'chat':
        // Access session via closure or bind
        // Note: handlers receive session context when called
        break;
      case 'ping':
        // Send messages
        break;
    }
  },

  handleBufferMessage: async (message: ArrayBuffer) => {
    // Handle binary messages if needed
  },

  handleClose: async (session) => {
    console.log('Session closed', session.data);
  },
};

// Create session class (can be extended if needed)
class ChatSession extends BaseSession<
  SessionData,
  ServerMessage,
  ClientMessage,
  Env
> {
  constructor(
    websocket: WebSocket,
    sessions: Map<WebSocket, ChatSession>
  ) {
    super(websocket, sessions, {
      createData: (ctx) => ({
        userId: crypto.randomUUID(),
        joinedAt: Date.now(),
      }),
      handleMessage: async (message) => {
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
      },
      handleBufferMessage: async (message) => {
        // Handle binary messages if needed
      },
      handleClose: async (session) => {
        console.log(`Session closed for user ${session.data.userId}`);
      },
    });
  }
}
```

### 3. Implement Your Durable Object

```typescript
import { BaseWebSocketDO } from '@firtoz/websocket-do';
import { Hono } from 'hono';

export class ChatRoomDO extends BaseWebSocketDO<ChatSession, Env> {
  app = this.getBaseApp()
    .get('/info', (ctx) => {
      return ctx.json({
        connectedUsers: this.sessions.size,
      });
    });

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, {
      createSession: (ctx, websocket) => {
        return new ChatSession(websocket, this.sessions);
      },
    });
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

## StandardSchemaWebSocketClient (Type-Safe Client)

`StandardSchemaWebSocketClient` provides a type-safe WebSocket client with automatic validation (Standard Schema v1) for both incoming and outgoing messages.

### Features

- ✅ **Automatic validation** - All messages validated with your Standard Schema–compatible schemas
- 🎯 **Full type inference** - TypeScript types automatically inferred from schemas
- 📦 **Dual mode** - Supports both JSON and msgpack (buffer) serialization
- 🔗 **DO Integration** - Works seamlessly with `honoDoFetcher` WebSocket connections
- 🛡️ **Error handling** - Validation errors caught and reported via callbacks

### Basic Usage

```typescript
import { StandardSchemaWebSocketClient } from '@firtoz/websocket-do';
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

// Wrap with StandardSchemaWebSocketClient
const client = new StandardSchemaWebSocketClient({
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
import { StandardSchemaWebSocketClient } from '@firtoz/websocket-do';

// 1. Connect to DO via honoDoFetcher
const api = honoDoFetcherWithName(env.CHAT_ROOM, 'room-1');
const wsResp = await api.websocket({
  url: '/websocket',
  config: { autoAccept: false }, // Let client control acceptance
});

// 2. Wrap with StandardSchemaWebSocketClient for type safety!
const client = new StandardSchemaWebSocketClient({
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
const client = new StandardSchemaWebSocketClient({
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
import type { StandardSchemaV1 } from "@standard-schema/spec";

interface StandardSchemaWebSocketClientOptions<TClientMessage, TServerMessage> {
  // Connection (provide one)
  url?: string;                    // Create new WebSocket
  webSocket?: WebSocket;           // Use existing WebSocket (e.g., from honoDoFetcher)
  
  // Schemas (required)
  clientSchema: StandardSchemaV1<unknown, TClientMessage>;
  serverSchema: StandardSchemaV1<unknown, TServerMessage>;
  
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

- `send(message: TClientMessage): Promise<void>` - Send a validated message (async Standard Schema validation)
- `close(code?: number, reason?: string): void` - Close the connection
- `waitForOpen(): Promise<void>` - Wait for connection to open

## StandardSchemaSession (Validated Sessions)

`StandardSchemaSession` extends `BaseSession` with automatic validation for incoming messages.

### Basic Usage

```typescript
import { StandardSchemaSession } from '@firtoz/websocket-do';
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
class ChatSession extends StandardSchemaSession<
  SessionData,
  ServerMessage,
  ClientMessage,
  Env
> {
  constructor(
    websocket: WebSocket,
    sessions: Map<WebSocket, ChatSession>,
    options: StandardSchemaSessionOptions<ClientMessage, ServerMessage>
  ) {
    super(websocket, sessions, options, {
      createData: (ctx) => ({ name: 'Anonymous' }),
      
      handleValidatedMessage: async (message) => {
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
      },

      handleClose: async (session) => {
        console.log(`${session.data.name} disconnected`);
      },
    });
  }
}
```

### Buffer Mode with StandardSchemaSession

```typescript
class ChatSession extends StandardSchemaSession<...> {
  constructor(
    websocket: WebSocket,
    sessions: Map<WebSocket, ChatSession>
  ) {
    super(websocket, sessions, {
      clientSchema: ClientMessageSchema,
      serverSchema: ServerMessageSchema,
      enableBufferMessages: true, // Enable buffer mode for msgpack
    }, {
      createData: (ctx) => ({ name: 'Anonymous' }),
      handleValidatedMessage: async (message) => {
        // Messages automatically decoded from msgpack
        // Handle validated message
      },
      handleClose: async (session) => {
        console.log('Session closed', session.data);
      },
    });
  }
}
```

## API Reference

### `BaseWebSocketDO<TSession, TEnv>`

Base class for creating WebSocket-enabled Durable Objects. Uses composition instead of inheritance.

#### Type Parameters

- `TSession` - Your session class extending `BaseSession`
- `TEnv` - Your Cloudflare Worker environment bindings

#### Constructor

```typescript
constructor(
  ctx: DurableObjectState,
  env: TEnv,
  options: BaseWebSocketDOOptions<TSession, TEnv>
)
```

#### Options Type

```typescript
type BaseWebSocketDOOptions<TSession, TEnv> = {
  createSession: (
    ctx: Context<{ Bindings: TEnv }> | undefined,
    websocket: WebSocket
  ) => TSession | Promise<TSession>;
};
```

#### Methods

- `getBaseApp(): Hono`
  - Returns a base Hono app with `/websocket` endpoint configured

- `handleSession(ctx: Context, ws: WebSocket): Promise<void>`
  - Handles new WebSocket connections

#### Properties

- `sessions: Map<WebSocket, TSession>` - Map of all active sessions
- `app: Hono` - Your Hono application (must be implemented)

### `BaseSession<TData, TServerMessage, TClientMessage, TEnv>`

Concrete class for managing individual WebSocket sessions. Uses composition pattern with handlers.

#### Type Parameters

- `TData` - Type of data stored in the session
- `TServerMessage` - Union type of messages sent to clients
- `TClientMessage` - Union type of messages received from clients
- `TEnv` - Your Cloudflare Worker environment bindings (default: `Cloudflare.Env`)

#### Constructor

```typescript
constructor(
  websocket: WebSocket,
  sessions: Map<WebSocket, BaseSession<TData, TServerMessage, TClientMessage, TEnv>>,
  handlers: BaseSessionHandlers<TData, TServerMessage, TClientMessage, TEnv>
)
```

#### Handlers Type

```typescript
type BaseSessionHandlers<TData, TServerMessage, TClientMessage, TEnv> = {
  createData?: (ctx: Context<{ Bindings: TEnv }>) => TData;
  handleMessage: (message: TClientMessage) => Promise<void>;
  handleBufferMessage: (message: ArrayBuffer) => Promise<void>;
  handleClose: (
    session: BaseSession<TData, TServerMessage, TClientMessage, TEnv>,
  ) => Promise<void>;
};
```

If `createData` is omitted, `startFresh` sets `data` to `{}` (use an empty `TData` such as `Record<string, never>`).

#### Methods

- `send(message: TServerMessage): void`
  - Send message to this session's client

- `broadcast(message: TServerMessage, excludeSelf?: boolean): void`
  - Send message to all connected sessions

- `startFresh(ctx: Context): void`
  - Initialize new session (called automatically). Uses `createData` when provided; otherwise `{}`.

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
export class ChatRoomDO extends BaseWebSocketDO<ChatSession, Env> {
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

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, {
      createSession: (ctx, websocket) => {
        return new ChatSession(websocket, this.sessions);
      },
    });
  }
}
```

### State Persistence

Session data is automatically serialized and persists across hibernation:

```typescript
class GameSession extends BaseSession<GameData, ServerMsg, ClientMsg, Env> {
  constructor(
    websocket: WebSocket,
    sessions: Map<WebSocket, GameSession>
  ) {
    super(websocket, sessions, {
      createData: (ctx) => ({
        playerName: ctx.req.query('name') || 'Anonymous',
        score: 0,
        inventory: [],
      }),

      handleMessage: async (message) => {
        if (message.type === 'collectItem') {
          this.data.inventory.push(message.item);
          this.data.score += 10;
          
          // Persist changes
          this.update();
          
          this.send({ type: 'scoreUpdate', score: this.data.score });
        }
      },

      handleBufferMessage: async (message) => {
        // Handle buffer messages if needed
      },

      handleClose: async (session) => {
        console.log('Game session closed', session.data);
      },
    });
  }
}
```

### Error Handling

Errors in message handlers are caught and logged, but don't crash the connection:

```typescript
class MySession extends BaseSession<...> {
  constructor(
    websocket: WebSocket,
    sessions: Map<WebSocket, MySession>
  ) {
    super(websocket, sessions, {
      createData: (ctx) => ({ /* ... */ }),

      handleMessage: async (message) => {
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
      },

      handleBufferMessage: async (message) => {
        // Handle buffer messages
      },

      handleClose: async (session) => {
        console.log('Session closed', session.data);
      },
    });
  }
}
```

## Exports

This package exports the following:

### Classes
- `BaseWebSocketDO` - Base class for WebSocket Durable Objects (composition-based)
- `BaseSession` - Concrete session class with handler injection
- `StandardSchemaWebSocketClient` - Type-safe WebSocket client with Standard Schema validation
- `StandardSchemaSession` - Concrete session class with validation and handler injection
- `StandardSchemaWebSocketDO` - Base class for WebSocket DOs with Standard Schema sessions
- `WebsocketWrapper` - Low-level WebSocket wrapper with typed attachments

### Types
- `BaseSessionHandlers` - Handler interface for `BaseSession`
- `BaseWebSocketDOOptions` - Options interface for `BaseWebSocketDO`
- `StandardSchemaSessionHandlers` - Handler interface for `StandardSchemaSession`
- `StandardSchemaSessionOptions` - Options interface for `StandardSchemaSession`
- `StandardSchemaSessionOptionsOrFactory` - Options or factory function for `StandardSchemaSession`
- `StandardSchemaWebSocketDOOptions` - Options interface for `StandardSchemaWebSocketDO`
- `StandardSchemaWebSocketClientOptions` - Options interface for `StandardSchemaWebSocketClient`

### Utilities
- `standardSchemaMsgpack` - Msgpack encode/decode with Standard Schema validation

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
import { BaseWebSocketDO, StandardSchemaSession, type StandardSchemaSessionOptions } from '@firtoz/websocket-do';
import { ClientMessageSchema, ServerMessageSchema } from './schemas';

interface SessionData {
  name: string;
  joinedAt: number;
}

class ChatSession extends StandardSchemaSession<SessionData, ServerMessage, ClientMessage, Env> {
  constructor(
    websocket: WebSocket,
    sessions: Map<WebSocket, ChatSession>,
    options: StandardSchemaSessionOptions<ClientMessage, ServerMessage>
  ) {
    super(websocket, sessions, options, {
      createData: () => ({
        name: 'Anonymous',
        joinedAt: Date.now(),
      }),

      handleValidatedMessage: async (message) => {
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
      },

      handleClose: async (session) => {
        console.log(`${session.data.name} disconnected`);
      },
    });
  }
}

export class ChatRoomDO extends BaseWebSocketDO<ChatSession, Env> {
  app = this.getBaseApp()
    .get('/info', (ctx) => {
      const users = Array.from(this.sessions.values()).map(s => ({
        name: s.data.name,
        joinedAt: s.data.joinedAt,
      }));
      return ctx.json({ users, count: users.length });
    });

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, {
      createSession: (ctx, websocket) => {
        return new ChatSession(websocket, this.sessions, {
          clientSchema: ClientMessageSchema,
          serverSchema: ServerMessageSchema,
          enableBufferMessages: true, // Use msgpack for efficiency
        });
      },
    });
  }
}

// client.ts - Client-side
import { StandardSchemaWebSocketClient } from '@firtoz/websocket-do';
import { honoDoFetcherWithName } from '@firtoz/hono-fetcher';
import { ClientMessageSchema, ServerMessageSchema } from './schemas';

async function connectToChat(env: Env, roomName: string) {
  // 1. Connect via honoDoFetcher
  const api = honoDoFetcherWithName(env.CHAT_ROOM, roomName);
  const wsResp = await api.websocket({
    url: '/websocket',
    config: { autoAccept: false },
  });

  // 2. Wrap with StandardSchemaWebSocketClient
  const client = new StandardSchemaWebSocketClient({
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
- ✅ Standard Schema validation in both JSON and msgpack modes
- ✅ Integration between honoDoFetcher and StandardSchemaWebSocketClient

For detailed information about testing capabilities, example implementations, comprehensive test coverage, and setup instructions, see the [websocket-do-test](../../tests/websocket-do-test/) package.

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details on how to contribute to this package.

