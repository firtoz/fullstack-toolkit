# @firtoz/router-toolkit

Type-safe React Router 7 framework mode helpers with enhanced fetching, form submission, and state management.

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
  "zod": "^4.0.0"
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

```tsx
import { useDynamicSubmitter } from '@firtoz/router-toolkit';
import { z } from 'zod/v4';

const formSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

function ContactForm() {
  const submitter = useDynamicSubmitter('/api/contact');

  const handleSubmit = (formData: z.infer<typeof formSchema>) => {
    submitter.submit(formData, { method: 'POST' });
  };

  return (
    <submitter.Form method="POST">
      <input name="name" type="text" />
      <input name="email" type="email" />
      <button type="submit">Submit</button>
    </submitter.Form>
  );
}
```

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

This toolkit is specifically designed for React Router 7's framework mode. Make sure your routes are properly typed in your `react-router.config.ts`:

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