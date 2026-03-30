# @firtoz/hono-fetcher

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fhono-fetcher.svg)](https://www.npmjs.com/package/@firtoz/hono-fetcher)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fhono-fetcher.svg)](https://www.npmjs.com/package/@firtoz/hono-fetcher)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fhono-fetcher.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

Type-safe Hono API client with full TypeScript inference for routes, params, and payloads.

> **⚠️ Early WIP Notice:** This package is in very early development and is **not production-ready**. It is TypeScript-only and may have breaking changes. While I (the maintainer) have limited time, I'm open to PRs for features, bug fixes, or additional support (like JS builds). Please feel free to try it out and contribute! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

## Features

- 🔒 **Fully Type-Safe** - Complete TypeScript inference for routes, parameters, request bodies, and responses
- 🎯 **Path Parameters** - Automatic extraction and validation of path parameters (`:id`, `:slug`, etc.)
- 📝 **Request Bodies** - Type-safe JSON and form data support with automatic serialization
- 🌐 **Cloudflare Workers** - First-class support for Durable Objects with `honoDoFetcher`
- 🔌 **WebSocket Support** - Type-safe WebSocket connections with automatic acceptance and configuration
- 🚀 **Zero Runtime Overhead** - All type inference happens at compile time
- 🔄 **Full HTTP Methods** - Support for GET, POST, PUT, DELETE, and PATCH

## Installation

```bash
bun add @firtoz/hono-fetcher
```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
bun add hono
```

For Durable Object support, use `wrangler types` to generate accurate types:

```bash
wrangler types
```

This generates `worker-configuration.d.ts` with types for your specific environment bindings.

## Quick Start

### Basic Usage

```typescript
import { Hono } from 'hono';
import { honoFetcher } from '@firtoz/hono-fetcher';

// Define your Hono app
const app = new Hono()
  .get('/users/:id', (c) => {
    const id = c.req.param('id');
    return c.json({ id, name: `User ${id}` });
  })
  .post('/users', async (c) => {
    const body = await c.req.json<{ name: string }>();
    return c.json({ id: '123', ...body });
  });

// Create a typed fetcher
const api = honoFetcher<typeof app>(app.request);

// Use it with full type safety!
const response = await api.get({
  url: '/users/:id',
  params: { id: '123' }, // ✅ Type-safe params
});

const user = await response.json(); // ✅ Inferred type: { id: string; name: string }

// POST with body
await api.post({
  url: '/users',
  body: { name: 'John' }, // ✅ Type-safe body
});
```

### Remote API Usage

For remote APIs, you have two options:

#### Option 1: Using `honoDirectFetcher` (Recommended)

```typescript
import { honoDirectFetcher } from '@firtoz/hono-fetcher';
import type { AppType } from './backend/app'; // Your backend app type

// Simply pass the base URL
const api = honoDirectFetcher<AppType>('https://api.example.com');

// Use it immediately
const response = await api.get({
  url: '/users/:id',
  params: { id: '123' }
});
```

#### Option 2: Using `honoFetcher` with Custom Fetch

```typescript
import { honoFetcher } from '@firtoz/hono-fetcher';

// For more control over the fetch behavior
const api = honoFetcher<typeof app>((url, init) => {
  return fetch(`https://api.example.com${url}`, init);
});
```

### Durable Objects

```typescript
import { honoDoFetcher, honoDoFetcherWithName } from '@firtoz/hono-fetcher';
import { DurableObject } from 'cloudflare:workers';
import { Hono } from 'hono';

// Define your Durable Object with a Hono app
export class ChatRoomDO extends DurableObject {
  app = new Hono()
    .get('/messages', (c) => {
      return c.json({ messages: [] });
    })
    .post('/messages', async (c) => {
      const { text } = await c.req.json<{ text: string }>();
      return c.json({ id: '1', text });
    });

  fetch(request: Request) {
    return this.app.fetch(request);
  }
}

// In your worker — use `using` so the RPC stub is disposed when the block exits
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // From namespace + name (recommended)
    using api = honoDoFetcherWithName(env.CHAT_ROOM, 'room-1');
    // Or from an existing stub: using api = honoDoFetcher(env.CHAT_ROOM.getByName('room-1'));
    const response = await api.get({ url: '/messages' });
    return response;
  }
};
```

## API Reference

### `honoFetcher<T>(fetcher)`

Creates a type-safe API client from a Hono app type.

#### Parameters

- `fetcher: (url: string, init?: RequestInit) => Response | Promise<Response>` - Function that performs the actual fetch

#### Returns

A typed fetcher with methods for each HTTP verb: `get`, `post`, `put`, `delete`, `patch`

#### Example

```typescript
const api = honoFetcher<typeof app>(app.request);
```

### `honoDirectFetcher<T>(baseUrl)`

Convenience wrapper around `honoFetcher` for remote APIs. Automatically prepends the base URL to all requests.

#### Parameters

- `baseUrl: string` - The base URL of your API (e.g., `'https://api.example.com'`)

#### Returns

A typed fetcher with methods for each HTTP verb: `get`, `post`, `put`, `delete`, `patch`

#### Example

```typescript
import { honoDirectFetcher } from '@firtoz/hono-fetcher';
import type { AppType } from './backend/app';

const api = honoDirectFetcher<AppType>('https://api.example.com');

// Make requests
const response = await api.get({
  url: '/users/:id',
  params: { id: '123' }
});
```

### Method Signature

All methods follow this signature:

```typescript
method({
  url: string;           // The route path
  params?: object;       // Path parameters (required if route has :params)
  body?: object;         // Request body (for POST/PUT/PATCH)
  form?: object;         // Form data (for POST/PUT/PATCH)
  init?: RequestInit;    // Additional fetch options
})
```

### Path Parameters

Routes with path parameters (`:id`, `:slug`, etc.) require the `params` field:

```typescript
const app = new Hono()
  .get('/users/:id', (c) => c.json({ id: c.req.param('id') }))
  .get('/posts/:id/comments/:commentId', (c) => 
    c.json({ 
      postId: c.req.param('id'),
      commentId: c.req.param('commentId') 
    })
  );

const api = honoFetcher<typeof app>(app.request);

// Single parameter
await api.get({
  url: '/users/:id',
  params: { id: '123' } // ✅ Required and type-safe
});

// Multiple parameters
await api.get({
  url: '/posts/:id/comments/:commentId',
  params: { id: '1', commentId: '42' } // ✅ Both required
});
```

### Request Bodies

#### JSON Bodies

```typescript
const app = new Hono()
  .post('/users', async (c) => {
    const { name, email } = await c.req.json<{ name: string; email: string }>();
    return c.json({ id: '1', name, email });
  });

const api = honoFetcher<typeof app>(app.request);

await api.post({
  url: '/users',
  body: { name: 'John', email: 'john@example.com' } // ✅ Type-safe
});
```

#### Form Data

```typescript
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono()
  .post('/upload', 
    zValidator('form', z.object({
      title: z.string(),
      count: z.coerce.number()
    })),
    async (c) => {
      const data = c.req.valid('form');
      return c.json({ success: true, data });
    }
  );

const api = honoFetcher<typeof app>(app.request);

await api.post({
  url: '/upload',
  form: { title: 'Hello', count: '5' } // ✅ Automatically sent as FormData
});
```

### Custom Headers and Options

Pass additional `fetch` options via the `init` parameter:

```typescript
await api.get({
  url: '/users/:id',
  params: { id: '123' },
  init: {
    headers: {
      'Authorization': 'Bearer token',
      'X-Custom-Header': 'value'
    },
    signal: abortController.signal
  }
});
```

## WebSocket Support

`hono-fetcher` provides first-class support for WebSocket connections with full type safety.

### Basic WebSocket Connection

```typescript
import { honoFetcher } from '@firtoz/hono-fetcher';

const api = honoFetcher<typeof app>(fetcher);

// Connect to a WebSocket endpoint
const wsResponse = await api.websocket({
  url: '/chat',
});

// Access the WebSocket
const ws = wsResponse.webSocket;
if (ws) {
  ws.send(JSON.stringify({ type: 'hello' }));
  
  ws.addEventListener('message', (event) => {
    console.log('Received:', event.data);
  });
}
```

### WebSocket with Auto-Accept

By default, WebSockets are **automatically accepted** for convenience:

```typescript
// Default behavior - WebSocket is auto-accepted
const wsResp = await api.websocket({
  url: '/websocket',
  // config.autoAccept defaults to true
});

// WebSocket is ready to use immediately!
wsResp.webSocket?.send('Hello!');
```

### Manual WebSocket Acceptance

For advanced scenarios where you need control over when the WebSocket is accepted:

```typescript
const wsResp = await api.websocket({
  url: '/websocket',
  config: { autoAccept: false }, // Disable auto-accept
});

const ws = wsResp.webSocket;
if (ws) {
  // Set up your listeners first
  ws.addEventListener('message', (event) => {
    console.log('Message:', event.data);
  });
  
  // Then manually accept when ready
  ws.accept();
}
```

### WebSocket with Path Parameters

```typescript
const api = honoFetcher<typeof app>(fetcher);

// WebSocket endpoint with path parameters
const wsResp = await api.websocket({
  url: '/rooms/:roomId/websocket',
  params: { roomId: 'room-123' }, // Type-safe params!
});
```

### Integration with ZodWebSocketClient

For even better type safety, combine with `@firtoz/websocket-do`'s `ZodWebSocketClient`:

```typescript
import { ZodWebSocketClient } from '@firtoz/websocket-do';
import { honoDoFetcherWithName } from '@firtoz/hono-fetcher';

// 1. Connect to DO WebSocket
const api = honoDoFetcherWithName(env.CHAT_ROOM, 'room-1');
const wsResp = await api.websocket({
  url: '/websocket',
  config: { autoAccept: false }, // Let ZodWebSocketClient handle acceptance
});

// 2. Wrap with type-safe client
const client = new ZodWebSocketClient({
  webSocket: wsResp.webSocket,
  clientSchema: ClientMessageSchema,
  serverSchema: ServerMessageSchema,
  onMessage: (message) => {
    // Fully typed message!
    console.log('Received:', message);
  },
});

// 3. Now accept
wsResp.webSocket?.accept();

// 4. Send type-safe messages
client.send({ type: 'chat', text: 'Hello!' }); // Validated with Zod!
```

See the [ZodWebSocketClient documentation](#) for more details on type-safe WebSocket communication.

## Durable Objects API

Each of `honoDoFetcher`, `honoDoFetcherWithName`, and `honoDoFetcherWithId` returns a fetcher that is also a **`Disposable`**: calling `api[Symbol.dispose]()` releases the underlying Durable Object stub. In production Workers, prefer the **`using`** declaration so disposal runs when the block exits (success or throw). See [Durable Object stubs and disposal](#durable-object-stubs-and-disposal) below.

### `honoDoFetcher<T>(stub)`

Creates a typed fetcher for a Durable Object stub with support for both HTTP and WebSocket connections.

**Returns:** `TypedDoFetcher<T> & Disposable`

```typescript
using api = honoDoFetcher(env.MY_DO.getByName('example'));

// HTTP requests
await api.get({ url: '/status' });

// WebSocket connections
const wsResp = await api.websocket({ url: '/ws' });
```

### `honoDoFetcherWithName<T>(namespace, name)`

Convenience method to create a fetcher from a namespace and name. Uses a single stub internally and wires disposal to that stub.

**Returns:** `TypedDoFetcher<DurableObjectStub<T>> & Disposable`

```typescript
using api = honoDoFetcherWithName(env.MY_DO, 'example');

// HTTP
await api.get({ url: '/status' });

// WebSocket
await api.websocket({ url: '/chat' });
```

### `honoDoFetcherWithId<T>(namespace, id)`

Convenience method to create a fetcher from a namespace and hex ID string.

**Returns:** `TypedDoFetcher<DurableObjectStub<T>> & Disposable`

```typescript
using api = honoDoFetcherWithId(env.MY_DO, 'abc123...');
await api.get({ url: '/status' });
```

### Durable Object stubs and disposal

- **Production Workers:** Durable Object stubs participate in RPC and should be released when you are done. The easiest pattern is **`using api = honoDoFetcherWithName(...)`** (or `honoDoFetcher` / `honoDoFetcherWithId`). You can also call **`api[Symbol.dispose]()`** manually (for example in a `finally` block) if you cannot use `using`.
- **Vite SSR, some Miniflare setups, or test mocks** may expose stubs that only implement **`fetch`** and not **`Symbol.dispose`**. The library checks for a callable `Symbol.dispose` before invoking it; if it is missing, disposal is a no-op (no `TypeError`).
- **Errors from `Symbol.dispose`:** If the runtime’s dispose implementation throws (for example during unwind after your code threw), the library catches the error and logs it with **`console.error`**. It does **not** rethrow, so your original error is not masked by a `SuppressedError`.
- **TypeScript `using`:** Add **`"ESNext.Disposable"`** to the `compilerOptions.lib` array in your **`tsconfig.json`** (alongside your existing libs) so `using` and `Disposable` type-check. TypeScript 5.2+ is required for `using`.

## Type Exports

### `TypedHonoFetcher<T>`

The main fetcher type with methods for all available HTTP verbs.

```typescript
import type { TypedHonoFetcher } from '@firtoz/hono-fetcher';

function createApi(): TypedHonoFetcher<typeof app> {
  return honoFetcher<typeof app>(app.request);
}
```

### `JsonResponse<T>`

Extended `Response` type with properly typed `json()` method.

```typescript
import type { JsonResponse } from '@firtoz/hono-fetcher';

const response: JsonResponse<{ id: string }> = await api.get({ url: '/user' });
const data = await response.json(); // Type: { id: string }
```

### `WebSocketConfig`

Configuration options for WebSocket connections.

```typescript
import type { WebSocketConfig } from '@firtoz/hono-fetcher';

const config: WebSocketConfig = {
  autoAccept: false, // Default: true
};

await api.websocket({ url: '/ws', config });
```

**Options:**
- `autoAccept?: boolean` - Whether to automatically call `accept()` on the WebSocket. Defaults to `true` for convenience. Set to `false` if you need manual control over when the WebSocket is accepted (e.g., when using with `ZodWebSocketClient`).

### `ParsePathParams<T>`

Utility type to extract path parameters from a route string.

```typescript
import type { ParsePathParams } from '@firtoz/hono-fetcher';

type Params = ParsePathParams<'/users/:id/posts/:postId'>;
// Type: { id: string; postId: string }
```

### `DOWithHonoApp`

Type for Durable Objects that expose a Hono app.

```typescript
import type { DOWithHonoApp } from '@firtoz/hono-fetcher';

export class MyDO extends DurableObject implements DOWithHonoApp {
  app = new Hono()
    .get('/status', (c) => c.json({ status: 'ok' }));
}
```

## Advanced Usage

### Sharing Types Between Frontend and Backend

```typescript
// backend/app.ts
export const app = new Hono()
  .get('/users/:id', (c) => c.json({ id: c.req.param('id'), name: 'User' }))
  .post('/users', async (c) => {
    const body = await c.req.json<{ name: string }>();
    return c.json({ id: '1', ...body });
  });

export type AppType = typeof app;

// frontend/api.ts
import type { AppType } from '../backend/app';
import { honoFetcher } from '@firtoz/hono-fetcher';

export const api = honoFetcher<AppType>((url, init) => {
  return fetch(`https://api.example.com${url}`, init);
});
```

### Error Handling

```typescript
try {
  const response = await api.post({
    url: '/users',
    body: { name: 'John' }
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('API error:', error);
    return;
  }

  const user = await response.json();
  console.log('Created user:', user);
} catch (error) {
  console.error('Network error:', error);
}
```

### Middleware and Authentication

```typescript
const createAuthenticatedFetcher = <T extends Hono>(token: string) => {
  return honoFetcher<T>((url, init) => {
    return fetch(`https://api.example.com${url}`, {
      ...init,
      headers: {
        ...init?.headers,
        'Authorization': `Bearer ${token}`
      }
    });
  });
};

const api = createAuthenticatedFetcher<typeof app>(userToken);
```

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details on how to contribute to this package.

