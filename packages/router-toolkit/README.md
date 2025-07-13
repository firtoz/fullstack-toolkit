# @firtoz/router-toolkit

Type-safe React Router 7 framework mode helpers with enhanced fetching, form submission, and state management for React Router 7 framework mode.

## Features

- ✅ **Type-safe routing** - Full TypeScript support with React Router 7 framework mode
- 🚀 **Enhanced fetching** - Dynamic fetchers with caching and query parameter support
- 📝 **Form submission** - Type-safe form handling with Zod validation
- 🔄 **State tracking** - Monitor fetcher state changes with ease
- 🎯 **Zero configuration** - Works out of the box with React Router 7
- 📦 **Tree-shakeable** - Import only what you need

## Installation

```bash
npm install @firtoz/router-toolkit
# or
yarn add @firtoz/router-toolkit
# or
pnpm add @firtoz/router-toolkit
# or
bun add @firtoz/router-toolkit
```

## Peer Dependencies

This package requires the following peer dependencies:

```json
{
  "react": "^18.0.0 || ^19.0.0",
  "react-router": "^7.0.0",
  "zod": "^4.0.5"
}
```

## Hooks

### `useDynamicFetcher`

Enhanced version of React Router's `useFetcher` with type safety and additional features.

```tsx
import { useDynamicFetcher } from '@firtoz/router-toolkit';

function MyComponent() {
  const fetcher = useDynamicFetcher('/api/users');

  const handleFetch = () => {
    // Basic fetch
    fetcher.load();
    
    // Fetch with query parameters
    fetcher.load({ page: '1', limit: '10' });
  };

  return (
    <div>
      {fetcher.state === 'loading' && <p>Loading...</p>}
      {fetcher.data && <pre>{JSON.stringify(fetcher.data, null, 2)}</pre>}
      <button onClick={handleFetch}>Fetch Data</button>
    </div>
  );
}
```

### `useCachedFetch`

Regular fetch-based hook that avoids route invalidation and provides caching.

```tsx
import { useCachedFetch } from '@firtoz/router-toolkit';

function CachedComponent() {
  const { data, isLoading, error } = useCachedFetch('/api/static-data');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>{JSON.stringify(data)}</div>;
}
```

### `useDynamicSubmitter`

Type-safe form submission with Zod validation and enhanced submit functionality.

**Basic Usage Pattern:**

```tsx
// app/routes/contact.tsx
import { useDynamicSubmitter, type RoutePath } from '@firtoz/router-toolkit';
import { z } from 'zod/v4';

// 1. Define your form schema
export const formSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

// 2. Export route constant
export const route: RoutePath<"contact"> = "contact";

// 3. Define your action
export const action = async ({ request }) => {
  const formData = await request.formData();
  // Handle submission
  return { success: true };
};

// 4. Use the hook (requires full route module setup)
export default function ContactForm() {
  // Note: This requires proper route module registration
  const submitter = useDynamicSubmitter<{
    file: "contact";
    action: typeof action;
    formSchema: typeof formSchema;
  }>("contact");

  return (
    <submitter.Form method="POST">
      <input name="name" type="text" />
      <input name="email" type="email" />
      <button type="submit">Submit</button>
    </submitter.Form>
  );
}
```

**Note:** `useDynamicSubmitter` requires advanced setup with route module registration and Zod schemas. For simpler use cases, you may prefer React Router's built-in `useFetcher`.

### `useFetcherStateChanged`

Track changes in fetcher state and react to them.

```tsx
import { useFetcher } from 'react-router';
import { useFetcherStateChanged } from '@firtoz/router-toolkit';

function StateTracker() {
  const fetcher = useFetcher();

  useFetcherStateChanged(fetcher, (lastState, newState) => {
    console.log(`State changed from ${lastState} to ${newState}`);
    
    if (newState === 'idle' && lastState === 'submitting') {
      // Handle successful submission
      console.log('Form submitted successfully!');
    }
  });

  return (
    <fetcher.Form method="POST" action="/api/submit">
      <button type="submit">Submit</button>
      <p>Current state: {fetcher.state}</p>
    </fetcher.Form>
  );
}
```

## Type Helpers

### `Func`

Generic function type helper for route loaders and actions.

```tsx
import type { Func } from '@firtoz/router-toolkit/types';

// Usage in route modules
type RouteModule = {
  file: keyof Register["pages"];
  loader: Func;
};
```

### `HrefArgs`

Type helper for extracting href arguments from route paths.

```tsx
import type { HrefArgs } from '@firtoz/router-toolkit/types';

// Usage for type-safe routing
type ProfileArgs = HrefArgs<'/profile/:id'>;
// ProfileArgs is [{ id: string }]
```

## Usage with React Router 7 Framework Mode

This toolkit is specifically designed for React Router 7's framework mode. Here's the recommended pattern for setting up routes with router-toolkit:

### Route Setup Pattern

For each route file, follow this pattern to enable full type safety:

```tsx
// app/routes/users.tsx
import { useDynamicFetcher, type RoutePath } from '@firtoz/router-toolkit';

// 1. Export your route constant with proper typing
export const route: RoutePath<"users"> = "users";

// 2. Define your loader/action as usual
export const loader = async () => {
  return { users: [] }; // Your data
};

// 3. Use the hook with typeof import for full type inference
export default function UsersPage() {
  const fetcher = useDynamicFetcher<typeof import("./users")>("users");

  const handleRefresh = () => {
    fetcher.load(); // No need to specify URL - it's inferred
  };

  return (
    <div>
      <button onClick={handleRefresh}>Refresh</button>
      {fetcher.data && <div>{JSON.stringify(fetcher.data)}</div>}
    </div>
  );
}
```

### Configuration

Make sure your routes are properly typed in your `react-router.config.ts`:

```tsx
// react-router.config.ts
import type { Config } from '@react-router/dev/config';

export default {
  // Your config
} satisfies Config;

// This will generate the Register types that the toolkit relies on
```

## Examples

### Complete Form with Validation

```tsx
import { useDynamicSubmitter } from '@firtoz/router-toolkit';
import { z } from 'zod/v4';

const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  age: z.number().min(18, 'Must be 18 or older'),
});

function UserForm() {
  const submitter = useDynamicSubmitter('/api/users');

  return (
    <div>
      <h2>Create User</h2>
      
      <submitter.Form method="POST">
        <div>
          <label htmlFor="name">Name:</label>
          <input name="name" type="text" required />
        </div>
        
        <div>
          <label htmlFor="email">Email:</label>
          <input name="email" type="email" required />
        </div>
        
        <div>
          <label htmlFor="age">Age:</label>
          <input name="age" type="number" required />
        </div>
        
        <button type="submit" disabled={submitter.state === 'submitting'}>
          {submitter.state === 'submitting' ? 'Creating...' : 'Create User'}
        </button>
      </submitter.Form>

      {submitter.data && (
        <div>
          <h3>Success!</h3>
          <p>User created: {JSON.stringify(submitter.data)}</p>
        </div>
      )}
    </div>
  );
}
```

### Data Fetching with Error Handling

```tsx
import { useDynamicFetcher, useFetcherStateChanged } from '@firtoz/router-toolkit';
import { useEffect, useState } from 'react';

function UserList() {
  const fetcher = useDynamicFetcher('/api/users');
  const [error, setError] = useState<string | null>(null);

  useFetcherStateChanged(fetcher, (lastState, newState) => {
    if (newState === 'idle' && fetcher.data?.error) {
      setError(fetcher.data.error);
    } else if (newState === 'loading') {
      setError(null);
    }
  });

  useEffect(() => {
    fetcher.load();
  }, []);

  const refetch = () => {
    fetcher.load({ refresh: 'true' });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>Users</h2>
        <button onClick={refetch} disabled={fetcher.state === 'loading'}>
          {fetcher.state === 'loading' ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'red', padding: '10px', background: '#fee' }}>
          Error: {error}
        </div>
      )}

      {fetcher.data?.users && (
        <ul>
          {fetcher.data.users.map((user: any) => (
            <li key={user.id}>
              {user.name} ({user.email})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [Firtina Ozbalikchi](https://github.com/firtoz)

## Links

- [GitHub Repository](https://github.com/firtoz/router-toolkit)
- [NPM Package](https://npmjs.com/package/@firtoz/router-toolkit)
- [React Router Documentation](https://reactrouter.com) 