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

## Quick Start

> **Prerequisites**: Make sure you have React Router 7 in framework mode set up. This toolkit requires the generated types from React Router's file-based routing.

### 1. Setup Your Route Files

Every route file needs to export a `route` constant for type inference:

```tsx
// app/routes/users.tsx
import { useDynamicFetcher, type RoutePath } from '@firtoz/router-toolkit';

export const route: RoutePath<"/users"> = "/users";

export const loader = async () => {
  return { users: [{ id: 1, name: "John" }] };
};

export default function UsersPage() {
  const fetcher = useDynamicFetcher<typeof import("./users")>("/users");
  
  return (
    <div>
      <button onClick={() => fetcher.load()}>
        {fetcher.state === "loading" ? "Loading..." : "Refresh"}
      </button>
      {fetcher.data && <pre>{JSON.stringify(fetcher.data, null, 2)}</pre>}
    </div>
  );
}
```

### 2. Use in Other Routes

```tsx
// app/routes/dashboard.tsx
import { useEffect } from 'react';
import { useDynamicFetcher } from '@firtoz/router-toolkit';

export default function Dashboard() {
  // Fetch data from the users route
  const usersFetcher = useDynamicFetcher<typeof import("./users")>("/users");
  
  useEffect(() => {
    usersFetcher.load(); // Load users data
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      {usersFetcher.data?.users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

### 3. Forms with Actions

```tsx
// app/routes/create-user.tsx
import { useDynamicSubmitter, type RoutePath } from '@firtoz/router-toolkit';

export const route: RoutePath<"/create-user"> = "/create-user";

export async function action({ request }) {
  const formData = await request.formData();
  const name = formData.get("name");
  return { success: true, user: { name } };
}

export default function CreateUser() {
  const submitter = useDynamicSubmitter<typeof import("./create-user")>("/create-user");
  
  return (
    <submitter.Form method="post">
      <input name="name" placeholder="User name" required />
      <button type="submit">
        {submitter.state === "submitting" ? "Creating..." : "Create"}
      </button>
      {submitter.data?.success && <p>✅ User created!</p>}
    </submitter.Form>
  );
}
```

**Key Points:**
- Export `route: RoutePath<"your-path">` in every route file
- Use `useDynamicFetcher<typeof import("./route-file")>` for type-safe data fetching
- Use `useDynamicSubmitter<typeof import("./route-file")>` for type-safe form submission
- Full TypeScript inference for `fetcher.data` and `submitter.data`

> **💡 Tip**: Start with `useDynamicFetcher` for data loading, then add `useDynamicSubmitter` for forms. The `useFetcherStateChanged` hook is great for notifications and side effects.

## Main Hooks

### `useDynamicFetcher`

Enhanced version of React Router's `useFetcher` with type safety and query parameter support.

```tsx
// app/routes/users.tsx
import { useDynamicFetcher, type RoutePath } from '@firtoz/router-toolkit';

export const route: RoutePath<"/users"> = "/users";

export const loader = async () => {
  return {
    users: [
      { id: 1, name: "John Doe", email: "john@example.com" }
    ],
    timestamp: new Date().toISOString()
  };
};

export default function UsersPage() {
  const fetcher = useDynamicFetcher<typeof import("./users")>("/users");

  const handleRefresh = () => {
    fetcher.load(); // Basic fetch
  };

  const handleRefreshWithParams = () => {
    fetcher.load({ page: "1", limit: "10", sort: "name" }); // With query params
  };

  return (
    <div>
      <button onClick={handleRefresh} disabled={fetcher.state === "loading"}>
        {fetcher.state === "loading" ? "Loading..." : "Refresh Data"}
      </button>
      
      <button onClick={handleRefreshWithParams} disabled={fetcher.state === "loading"}>
        Load with Filters
      </button>
      
      {fetcher.data && (
        <div>
          <h3>Users ({fetcher.data.users.length}):</h3>
          <pre>{JSON.stringify(fetcher.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

### `useDynamicSubmitter`

Type-safe form submission with Zod validation and enhanced submit functionality. Works seamlessly with route modules for full type inference.

```tsx
// app/routes/contact.tsx
import { useDynamicSubmitter, type RoutePath } from '@firtoz/router-toolkit';
import { z } from 'zod/v4';
import type { Route } from './+types/contact';

// 1. Define your form schema
export const formSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

// 2. Export route constant
export const route: RoutePath<"/contact"> = "/contact";

// 3. Define your action
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  // Simple validation
  if (!name || !email) {
    return {
      success: false,
      message: "Name and email are required"
    };
  }

  return {
    success: true,
    message: "Form submitted successfully!",
    submittedData: { name, email }
  };
}

// 4. Use the hook with typeof import for full type inference
export default function ContactForm() {
  const submitter = useDynamicSubmitter<typeof import("./contact")>("/contact");

  return (
    <div>
      <submitter.Form method="post">
        <div>
          <label htmlFor="name">Name:</label>
          <input
            id="name"
            name="name"
            type="text"
            required
          />
        </div>
        
        <div>
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            name="email"
            type="email"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={submitter.state === "submitting"}
        >
          {submitter.state === "submitting" ? "Submitting..." : "Submit"}
        </button>
      </submitter.Form>

      {submitter.data && (
        <div>
          {submitter.data.success ? (
            <p>✅ {submitter.data.message}</p>
          ) : (
            <p>❌ {submitter.data.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

### `useFetcherStateChanged`

Track changes in fetcher state and react to them. Perfect for triggering side effects, showing notifications, or handling state transitions in your application.

```tsx
// app/routes/notification-form.tsx
import { useDynamicSubmitter, useFetcherStateChanged, type RoutePath } from '@firtoz/router-toolkit';
import { useState } from 'react';
import { z } from 'zod/v4';
import type { Route } from './+types/notification-form';

export const route: RoutePath<"/notification-form"> = "/notification-form";

export const formSchema = z.object({
  message: z.string().min(1),
  type: z.enum(["info", "warning", "error"]),
});

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const message = formData.get("message") as string;
  const type = formData.get("type") as string;

  // Simulate processing
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    success: true,
    message: "Notification sent!",
    data: { message, type }
  };
}

export default function NotificationForm() {
  const submitter = useDynamicSubmitter<typeof import("./notification-form")>("/notification-form");
  const [notifications, setNotifications] = useState<string[]>([]);

  // Track fetcher state changes for side effects
  useFetcherStateChanged(submitter, (lastState, newState) => {
    console.log(`Fetcher state changed from ${lastState} to ${newState}`);
    
    // Show success notification when form submission completes
    if (newState === 'idle' && lastState === 'submitting') {
      if (submitter.data?.success) {
        setNotifications(prev => [...prev, `✅ ${submitter.data.message}`]);
      } else {
        setNotifications(prev => [...prev, `❌ Submission failed`]);
      }
    }
    
    // Clear notifications when starting new submission
    if (newState === 'submitting' && lastState === 'idle') {
      setNotifications([]);
    }
  });

  return (
    <div>
      <h1>Send Notification</h1>
      
      <submitter.Form method="post">
        <div>
          <label htmlFor="message">Message:</label>
          <input
            id="message"
            name="message"
            type="text"
            required
          />
        </div>
        
        <div>
          <label htmlFor="type">Type:</label>
          <select id="type" name="type" required>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        
        <button 
          type="submit" 
          disabled={submitter.state === 'submitting'}
        >
          {submitter.state === 'submitting' ? 'Sending...' : 'Send Notification'}
        </button>
        
        <p>Current state: <strong>{submitter.state}</strong></p>
      </submitter.Form>

      {/* Show notifications triggered by state changes */}
      {notifications.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Notifications:</h3>
          {notifications.map((notification, index) => (
            <div key={index} style={{ padding: '5px', margin: '5px 0', backgroundColor: '#f0f0f0' }}>
              {notification}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Common Use Cases:**

- **Notifications**: Show success/error messages after form submissions
- **Analytics**: Track form submission events and user interactions
- **UI Updates**: Update other parts of the UI based on fetcher state
- **Side Effects**: Trigger API calls, redirects, or other actions on state changes
- **Debugging**: Log state transitions for debugging purposes

**State Transitions:**
- `idle` → `submitting`: Form submission started
- `submitting` → `idle`: Form submission completed (check `fetcher.data` for results)
- `idle` → `loading`: Data fetching started (with `useDynamicFetcher`)
- `loading` → `idle`: Data fetching completed

## Type Utilities

### `RoutePath<T>`

Type-safe route path helper that ensures you're using valid route paths from your React Router configuration.

```tsx
import type { RoutePath } from '@firtoz/router-toolkit';

// Ensures "/users" is a valid route in your app
export const route: RoutePath<"/users"> = "/users";

// TypeScript error if route doesn't exist
export const invalidRoute: RoutePath<"/non-existent"> = "/non-existent"; // ❌ Error
```

This is the main type utility you'll use. It provides compile-time validation that your route paths actually exist in your React Router configuration.

## Additional Utilities

### `useCachedFetch`

Alternative to `useDynamicFetcher` that uses standard `fetch()` instead of React Router's fetcher system. Provides automatic caching and avoids route invalidation.

```tsx
// app/routes/config.tsx
import { useCachedFetch, type RoutePath } from '@firtoz/router-toolkit';

export const route: RoutePath<"/config"> = "/config";

export const loader = async () => {
  return {
    apiUrl: "https://api.example.com",
    version: "1.0.0",
    features: ["auth", "payments"]
  };
};

export default function ConfigPage() {
  const { data, isLoading, error } = useCachedFetch<typeof import("./config")>("/config");

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <h1>Configuration</h1>
      <p>API: {data?.apiUrl}</p>
      <p>Version: {data?.version}</p>
    </div>
  );
}
```

**When to use `useCachedFetch` vs `useDynamicFetcher`:**

- **`useCachedFetch`**: Static data, configuration, content that rarely changes
- **`useDynamicFetcher`**: Dynamic data, user-specific content, data that changes frequently

## Configuration

Make sure your routes are properly typed in your `react-router.config.ts`:

```tsx
// react-router.config.ts
import type { Config } from '@react-router/dev/config';

export default {
  // Your config
} satisfies Config;

// This will generate the Register types that the toolkit relies on
```

## Real-World Examples

These examples are based on actual usage patterns from the router-toolkit test application. Each example is complete and can be copied directly into your project.

> **🚀 Quick Copy**: Each example below is a complete, working route file. Copy the entire code block to get started immediately.

### Data Loading with Refresh (Loader Test Pattern)

```tsx
// app/routes/loader-test.tsx
import { useDynamicFetcher, type RoutePath } from '@firtoz/router-toolkit';

interface LoaderData {
  user: {
    id: number;
    name: string;
    email: string;
  };
  timestamp: string;
}

export const route: RoutePath<"/loader-test"> = "/loader-test";

export const loader = async (): Promise<LoaderData> => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    user: {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
    },
    timestamp: new Date().toISOString(),
  };
};

export default function LoaderTest() {
  const fetcher = useDynamicFetcher<typeof import("./loader-test")>("/loader-test");

  const handleRefresh = () => {
    fetcher.load();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Loader Test</h1>
      <p className="mb-4">Testing React Router useFetcher hook</p>

      <button
        type="button"
        onClick={handleRefresh}
        disabled={fetcher.state === "loading"}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {fetcher.state === "loading" ? "Loading..." : "Refresh Data"}
      </button>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Fetcher State:</h2>
        <pre className="bg-gray-200 p-3 rounded text-sm text-gray-800">
          {JSON.stringify({ state: fetcher.state }, null, 2)}
        </pre>
      </div>

      {fetcher.data && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Fetched Data:</h2>
          <pre className="bg-gray-200 p-3 rounded text-sm text-gray-800">
            {JSON.stringify(fetcher.data, null, 2)}
          </pre>
        </div>
      )}

      {fetcher.state === "idle" && fetcher.data && (
        <div className="mt-4 p-3 bg-green-100 rounded">
          <p className="text-green-800">✅ Data loaded successfully!</p>
        </div>
      )}
    </div>
  );
}
```

### Form Submission (Action Test Pattern)

```tsx
// app/routes/action-test.tsx
import { useDynamicSubmitter, type RoutePath } from '@firtoz/router-toolkit';
import { z } from 'zod/v4';
import type { Route } from './+types/action-test';

interface ActionData {
  success: boolean;
  message: string;
  submittedData?: {
    name: string;
    email: string;
  };
}

export const route: RoutePath<"/action-test"> = "/action-test";

export const formSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

export async function action({ request }: Route.ActionArgs): Promise<ActionData> {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Simple validation
  if (!name || !email) {
    return {
      success: false,
      message: "Name and email are required",
    };
  }

  return {
    success: true,
    message: "Form submitted successfully!",
    submittedData: { name, email },
  };
}

export default function ActionTest() {
  const submitter = useDynamicSubmitter<typeof import("./action-test")>("/action-test");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Action Test</h1>
      <p className="mb-4">Testing React Router form actions</p>

      <submitter.Form method="post" className="space-y-4 max-w-md">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Name:
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email:
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitter.state === "submitting"}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {submitter.state === "submitting" ? "Submitting..." : "Submit"}
        </button>
      </submitter.Form>

      {submitter.data && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Action Result:</h2>
          <pre className="bg-gray-200 p-3 rounded text-sm text-gray-800">
            {JSON.stringify(submitter.data, null, 2)}
          </pre>

          {submitter.data.success ? (
            <div className="mt-4 p-3 bg-green-100 rounded">
              <p className="text-green-800">✅ {submitter.data.message}</p>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-red-100 rounded">
              <p className="text-red-800">❌ {submitter.data.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Combined Loader and Action (Full CRUD Pattern)

```tsx
// app/routes/combined-test.tsx
import {
  useDynamicFetcher,
  useDynamicSubmitter,
  type RoutePath,
} from '@firtoz/router-toolkit';
import { useLoaderData } from 'react-router';
import { z } from 'zod/v4';
import type { Route } from './+types/combined-test';

interface User {
  id: number;
  name: string;
  email: string;
  lastUpdated: string;
}

interface LoaderData {
  user: User;
}

type ActionData = {
  success: boolean;
  message: string;
  updatedUser?: User;
};

export const route: RoutePath<"/combined-test"> = "/combined-test";

export const formSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

export const loader = async (): Promise<LoaderData> => {
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    user: {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      lastUpdated: new Date().toISOString(),
    },
  };
};

export async function action({ request }: Route.ActionArgs): Promise<ActionData> {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  await new Promise((resolve) => setTimeout(resolve, 500));

  if (!name || !email) {
    return {
      success: false,
      message: "Name and email are required",
    };
  }

  const updatedUser: User = {
    id: 1,
    name,
    email,
    lastUpdated: new Date().toISOString(),
  };

  return {
    success: true,
    message: "User updated successfully!",
    updatedUser,
  };
}

export default function CombinedTest() {
  const loaderData = useLoaderData<LoaderData>();
  const fetcher = useDynamicFetcher<typeof import("./combined-test")>("/combined-test");
  const submitter = useDynamicSubmitter<typeof import("./combined-test")>("/combined-test");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Combined Test</h1>
      <p className="mb-4">Testing both loader data and form actions</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Loader Data Section */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Current User Data</h2>
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="font-medium">Loaded from Server:</h3>
            <pre className="mt-2 text-sm bg-gray-200 p-3 rounded text-gray-800">
              {JSON.stringify(loaderData.user, null, 2)}
            </pre>
          </div>
        </div>

        {/* Action Form Section */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Update User</h2>
          <submitter.Form method="post" className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Name:
              </label>
              <input
                id="name"
                name="name"
                type="text"
                defaultValue={loaderData.user.name}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email:
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={loaderData.user.email}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitter.state === "submitting"}
              className="bg-purple-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {submitter.state === "submitting" ? "Updating..." : "Update User"}
            </button>
          </submitter.Form>
        </div>
      </div>

      {/* Status Section */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Action Status:</h2>
        <pre className="bg-gray-200 p-3 rounded text-sm text-gray-800">
          {JSON.stringify({ state: submitter.state }, null, 2)}
        </pre>
      </div>

      {submitter.data && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Action Result:</h2>
          <pre className="bg-gray-200 p-3 rounded text-sm text-gray-800">
            {JSON.stringify(submitter.data, null, 2)}
          </pre>

          {submitter.data.success ? (
            <div className="mt-4 p-3 bg-green-100 rounded">
              <p className="text-green-800">✅ {submitter.data.message}</p>
              {submitter.data.updatedUser && (
                <p className="text-sm text-green-700 mt-1">
                  Tip: Reload the page to see if data persists (it won't in this demo)
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 p-3 bg-red-100 rounded">
              <p className="text-red-800">❌ {submitter.data.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## MaybeError Utility

The router-toolkit includes the `@firtoz/maybe-error` package, which provides type-safe error handling utilities using discriminated unions. This is perfect for handling operations that may fail in your route loaders and actions.

### Basic Usage

```tsx
import { success, fail, type MaybeError } from '@firtoz/router-toolkit';

// Define a function that may fail
function divide(a: number, b: number): MaybeError<number> {
  if (b === 0) {
    return fail("Division by zero");
  }
  return success(a / b);
}

// Type-safe error handling
const result = divide(10, 2);
if (result.success) {
  console.log(result.result); // 5 - TypeScript knows this is a number
} else {
  console.error(result.error); // "Division by zero" - TypeScript knows this is a string
}
```

### Route Loader with Error Handling

```tsx
// app/routes/user-profile.tsx
import { success, fail, type MaybeError, type RoutePath } from '@firtoz/router-toolkit';
import type { Route } from './+types/user-profile';

interface User {
  id: string;
  name: string;
  email: string;
}

interface ApiError {
  code: number;
  message: string;
}

export const route: RoutePath<"/user-profile/:id"> = "/user-profile/:id";

// Loader that returns MaybeError for type-safe error handling
export const loader = async ({ params }: Route.LoaderArgs): Promise<MaybeError<User, ApiError>> => {
  try {
    const response = await fetch(`/api/users/${params.id}`);
    
    if (!response.ok) {
      return fail({
        code: response.status,
        message: response.status === 404 ? "User not found" : "Failed to fetch user"
      });
    }
    
    const user = await response.json();
    return success(user);
  } catch (error) {
    return fail({
      code: 500,
      message: "Network error occurred"
    });
  }
};

export default function UserProfile() {
  const fetcher = useDynamicFetcher<typeof import("./user-profile")>("/user-profile/:id", { id: "123" });
  
  // Handle the MaybeError result
  if (!fetcher.data) {
    return <div>Loading...</div>;
  }
  
  if (!fetcher.data.success) {
    return (
      <div className="error">
        <h2>Error {fetcher.data.error.code}</h2>
        <p>{fetcher.data.error.message}</p>
      </div>
    );
  }
  
  return (
    <div>
      <h1>{fetcher.data.result.name}</h1>
      <p>Email: {fetcher.data.result.email}</p>
    </div>
  );
}
```

### Action with Error Handling

```tsx
// app/routes/create-user.tsx
import { success, fail, type MaybeError, useDynamicSubmitter, type RoutePath } from '@firtoz/router-toolkit';
import { z } from 'zod/v4';
import type { Route } from './+types/create-user';

export const route: RoutePath<"/create-user"> = "/create-user";

export const formSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

interface ValidationError {
  field: string;
  message: string;
}

export async function action({ request }: Route.ActionArgs): Promise<MaybeError<User, ValidationError[]>> {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  // Validation
  const errors: ValidationError[] = [];
  if (!name) errors.push({ field: "name", message: "Name is required" });
  if (!email) errors.push({ field: "email", message: "Email is required" });
  if (email && !email.includes("@")) errors.push({ field: "email", message: "Invalid email format" });

  if (errors.length > 0) {
    return fail(errors);
  }

  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email })
    });

    if (!response.ok) {
      return fail([{ field: "general", message: "Failed to create user" }]);
    }

    const user = await response.json();
    return success(user);
  } catch (error) {
    return fail([{ field: "general", message: "Network error occurred" }]);
  }
}

export default function CreateUser() {
  const submitter = useDynamicSubmitter<typeof import("./create-user")>("/create-user");

  return (
    <div>
      <h1>Create User</h1>
      
      <submitter.Form method="post">
        <div>
          <label htmlFor="name">Name:</label>
          <input id="name" name="name" type="text" required />
        </div>
        
        <div>
          <label htmlFor="email">Email:</label>
          <input id="email" name="email" type="email" required />
        </div>
        
        <button type="submit" disabled={submitter.state === "submitting"}>
          {submitter.state === "submitting" ? "Creating..." : "Create User"}
        </button>
      </submitter.Form>

      {submitter.data && (
        <div>
          {submitter.data.success ? (
            <div className="success">
              <h3>User Created!</h3>
              <p>Name: {submitter.data.result.name}</p>
              <p>Email: {submitter.data.result.email}</p>
            </div>
          ) : (
            <div className="errors">
              <h3>Validation Errors:</h3>
              <ul>
                {submitter.data.error.map((error, index) => (
                  <li key={index}>
                    <strong>{error.field}:</strong> {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### MaybeError API Reference

```tsx
// Type definitions
type MaybeError<T = undefined, TError = string> = DefiniteSuccess<T> | DefiniteError<TError>;

type DefiniteSuccess<T> = {
  success: true;
  result: T; // Optional if T is undefined
};

type DefiniteError<TError> = {
  success: false;
  error: TError;
};

// Utility functions
const success = <T>(value: T): DefiniteSuccess<T> => ({ success: true, result: value });
const fail = <TError>(error: TError): DefiniteError<TError> => ({ success: false, error });

// Type utility
type AssumeSuccess<T extends MaybeError<unknown>> = /* extracts the success type */;
```

**Benefits:**
- **Type Safety**: TypeScript enforces error handling at compile time
- **Explicit Error Handling**: No more forgotten try-catch blocks
- **Consistent API**: Same pattern across all operations that may fail
- **Composable**: Easy to chain operations and handle errors at the right level

## Troubleshooting

### Common Issues

**❌ "Type 'string' is not assignable to type 'RoutePath<...>'"**
```tsx
// ❌ Wrong - using string literal
export const route = "/users";

// ✅ Correct - using RoutePath type
export const route: RoutePath<"/users"> = "/users";
```

**❌ "Property 'data' does not exist on type 'any'"**
```tsx
// ❌ Wrong - missing typeof import
const fetcher = useDynamicFetcher("/users");

// ✅ Correct - with typeof import for type inference
const fetcher = useDynamicFetcher<typeof import("./users")>("/users");
```

**❌ "Cannot find module './+types/route-name'"**
- Make sure you're using React Router 7 in framework mode
- Check that your `react-router.config.ts` is properly configured
- The `+types` directory is auto-generated by React Router

**❌ "fetcher.data is always undefined"**
```tsx
// ❌ Wrong - forgot to call load()
const fetcher = useDynamicFetcher<typeof import("./users")>("/users");

// ✅ Correct - call load() to fetch data
const fetcher = useDynamicFetcher<typeof import("./users")>("/users");
useEffect(() => {
  fetcher.load();
}, []);
```

### Getting Help

- Check the [React Router 7 documentation](https://reactrouter.com) for framework mode setup
- Look at the test application in the `tests/` directory for working examples
- Open an issue on [GitHub](https://github.com/firtoz/router-toolkit) if you find a bug

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [Firtina Ozbalikchi](https://github.com/firtoz)

## Links

- [GitHub Repository](https://github.com/firtoz/router-toolkit)
- [NPM Package](https://npmjs.com/package/@firtoz/router-toolkit)
- [React Router Documentation](https://reactrouter.com) 