# @firtoz/websocket-do

Type-safe WebSocket session management for Cloudflare Durable Objects with Hono integration.

## Features

- 🔒 **Type-safe** - Full TypeScript support with generic types for messages and session data
- 🌐 **WebSocket Management** - Built on Cloudflare Durable Objects for stateful WebSocket connections
- 🎯 **Session-based** - Abstract session class for easy implementation of custom WebSocket logic
- 🔄 **State Persistence** - Automatic serialization/deserialization of session data
- 📡 **Broadcasting** - Built-in support for broadcasting messages to all connected clients
- 🚀 **Hono Integration** - Seamless integration with Hono framework for routing

## Installation

```bash
bun add @firtoz/websocket-do
```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
bun add hono @cloudflare/workers-types @firtoz/hono-fetcher
```

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

```typescript
// wrangler.toml
[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoomDO"
script_name = "your-worker-name"

[[migrations]]
tag = "v1"
new_classes = ["ChatRoomDO"]
```

### 5. Access from Your Worker

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/chat') {
      const id = env.CHAT_ROOM.idFromName('global-chat');
      const stub = env.CHAT_ROOM.get(id);
      
      // Proxy to the Durable Object
      return stub.fetch(request);
    }
    
    return new Response('Not found', { status: 404 });
  }
};
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

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details on how to contribute to this package.

