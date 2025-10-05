# @firtoz/hono-fetcher

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fhono-fetcher.svg)](https://www.npmjs.com/package/@firtoz/hono-fetcher)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fhono-fetcher.svg)](https://www.npmjs.com/package/@firtoz/hono-fetcher)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fhono-fetcher.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

Type-safe Hono API client with full TypeScript inference for routes, params, and payloads.

## Features

- 🔒 **Fully Type-Safe** - Complete TypeScript inference for routes, parameters, request bodies, and responses
- 🎯 **Path Parameters** - Automatic extraction and validation of path parameters (`:id`, `:slug`, etc.)
- 📝 **Request Bodies** - Type-safe JSON and form data support with automatic serialization
- 🌐 **Cloudflare Workers** - First-class support for Durable Objects with `honoDoFetcher`
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

For Durable Object support:

```bash
bun add @cloudflare/workers-types
```

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

```typescript
import { honoFetcher } from '@firtoz/hono-fetcher';

// For a remote API, you need to define the app type
// (Usually exported from your backend)
const api = honoFetcher<typeof app>((url, init) => {
  return fetch(`https://api.example.com${url}`, init);
});
```

### Durable Objects

```typescript
import { honoDoFetcher, honoDoFetcherWithName } from '@firtoz/hono-fetcher/honoDoFetcher';
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

// In your worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Option 1: From a stub
    const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('room-1'));
    const api = honoDoFetcher(stub);
    
    // Option 2: Directly with name
    const api2 = honoDoFetcherWithName(env.CHAT_ROOM, 'room-1');
    
    // Use it!
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

## Durable Objects API

### `honoDoFetcher<T>(stub)`

Creates a typed fetcher for a Durable Object stub.

```typescript
const stub = env.MY_DO.get(env.MY_DO.idFromName('example'));
const api = honoDoFetcher(stub);

await api.get({ url: '/status' });
```

### `honoDoFetcherWithName<T>(namespace, name)`

Convenience method to create a fetcher from a namespace and name.

```typescript
const api = honoDoFetcherWithName(env.MY_DO, 'example');
await api.get({ url: '/status' });
```

### `honoDoFetcherWithId<T>(namespace, id)`

Convenience method to create a fetcher from a namespace and hex ID string.

```typescript
const api = honoDoFetcherWithId(env.MY_DO, 'abc123...');
await api.get({ url: '/status' });
```

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
import type { DOWithHonoApp } from '@firtoz/hono-fetcher/honoDoFetcher';

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

