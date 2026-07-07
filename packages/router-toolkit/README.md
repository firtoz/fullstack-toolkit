# @firtoz/router-toolkit

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Frouter-toolkit.svg)](https://www.npmjs.com/package/@firtoz/router-toolkit)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Frouter-toolkit.svg)](https://www.npmjs.com/package/@firtoz/router-toolkit)
[![license](https://img.shields.io/npm/l/%40firtoz%2Frouter-toolkit.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![React Router](https://img.shields.io/badge/React_Router-7%20%7C%208-red)](https://reactrouter.com)

**React Router 7/8 framework mode helpers** — typed fetchers, submitters, concurrent uploads, and Zod form actions wired to your route modules.

> **⚠️ Early WIP Notice:** This package is in very early development and is **not production-ready**. It is TypeScript-only and may have breaking changes. While I (the maintainer) have limited time, I'm open to PRs for features, bug fixes, or additional support (like JS builds). Please feel free to try it out and contribute! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

## Features

- ✅ **Type-safe routing** - Full TypeScript support with React Router 7/8 framework mode
- 🚀 **Enhanced fetching** - Dynamic fetchers with caching and query parameter support
- 📝 **Form submission** - Type-safe form handling with Zod validation
- 📤 **Concurrent submissions** - Multiple parallel submissions per action with per-operation tracking and optimistic UI (`ConcurrentSubmitterProvider` + `useConcurrentSubmitter`)
- 🔄 **State tracking** - Monitor fetcher state changes with ease
- 🎯 **Zero configuration** - Works out of the box with React Router 7 or 8
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
  "react": "^19.2.7",
  "react-router": "^7.14.2 || ^8.0.0",
  "zod": "^4.4.2"
}
```

## Quick Start

> **Prerequisites**: React Router 7.14+ or 8.x in framework mode. This toolkit requires the generated types from React Router's file-based routing. In React Router 8, middleware is always enabled — `formAction` handlers receive `context` as a `RouterContextProvider` (use `context.get(yourContext)` for typed middleware values).

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

`useDynamicSubmitter` returns a **stable** `{ submit, submitJson, Form, fetcherKey }` and does not expose `state` / `data`. Use `useDynamicSubmitterFetcher(submitter)` when you need reactive loading or action results in JSX (or `submitter.fetcherKey` with `useFetcher` for advanced cases).

```tsx
// app/routes/create-user.tsx
import {
  useDynamicSubmitter,
  useDynamicSubmitterFetcher,
  type RoutePath,
} from '@firtoz/router-toolkit';

export const route: RoutePath<"/create-user"> = "/create-user";

export async function action({ request }) {
  const formData = await request.formData();
  const name = formData.get("name");
  return { success: true, user: { name } };
}

export default function CreateUser() {
  const path = "/create-user" as const;
  const submitter = useDynamicSubmitter<typeof import("./create-user")>(path);
  const fetcher = useDynamicSubmitterFetcher(submitter);

  return (
    <submitter.Form method="post">
      <input name="name" placeholder="User name" required />
      <button type="submit">
        {fetcher.state === "submitting" ? "Creating..." : "Create"}
      </button>
      {fetcher.data?.success && <p>✅ User created!</p>}
    </submitter.Form>
  );
}
```

**Key Points:**
- Export `route: RoutePath<"your-path">` in every route file
- Use `useDynamicFetcher<typeof import("./route-file")>` for type-safe data fetching
- Use `useDynamicSubmitter<typeof import("./route-file")>` for type-safe `submit` / `submitJson` / `Form`; use `useDynamicSubmitterFetcher(submitter)` for reactive `state` / `data` on the same submission (optional `keySuffix` when two submitters share one URL)
- Await `submit` / `submitJson` for programmatic flows; full TypeScript inference on the resolved payload

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

Type-safe `submit`, `submitJson`, and `Form` with a **stable** return object (`fetcherKey` included). Use `await submitJson(...)` (or `await submit(...)`) for action payloads; use `useDynamicSubmitterFetcher(submitter)` when you need `fetcher.state` / `fetcher.data` in the UI.

```tsx
// app/routes/contact.tsx
import {
  useDynamicSubmitter,
  useDynamicSubmitterFetcher,
  type RoutePath,
} from '@firtoz/router-toolkit';
import { z } from 'zod';
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

// 4. Submitter + matching fetcher for reactive UI
export default function ContactForm() {
  const path = "/contact" as const;
  const submitter = useDynamicSubmitter<typeof import("./contact")>(path);
  const fetcher = useDynamicSubmitterFetcher(submitter);

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
          disabled={fetcher.state === "submitting"}
        >
          {fetcher.state === "submitting" ? "Submitting..." : "Submit"}
        </button>
      </submitter.Form>

      {fetcher.data && (
        <div>
          {fetcher.data.success ? (
            <p>✅ {fetcher.data.message}</p>
          ) : (
            <p>❌ {fetcher.data.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

#### Local `useState` vs `useDynamicSubmitterFetcher`

Both are valid; pick based on how you want loading and action feedback to show up.

**Local state around `await` (e.g. `saving` + `try` / `finally`)**

- **Pros:** Matches the promise-first API; no extra hook; the pending flag tracks exactly your async handler (including extra `await`s in the same function); easy to reason about when you reload data after save (e.g. `useDynamicFetcher.load()`).
- **Cons:** You must remember `finally` (or equivalent); one flag is awkward if several overlapping operations need distinct UX; you do not get declarative `fetcher.data` for the action unless you store the awaited value yourself.

**`useDynamicSubmitterFetcher(submitter)`**

- **Pros:** Declarative `fetcher.state` / `fetcher.data` / `fetcher.error` in JSX—good for `<submitter.Form>`, inline validation or handler errors, and staying aligned with React Router’s fetcher lifecycle on `submitter.fetcherKey`.
- **Cons:** Second `useFetcher` subscription; UI follows RR’s state machine, not only “my handler,” unless you isolate keys with `keySuffix` when two widgets share one URL.

**Rule of thumb:** Use **local pending state** when the flow is “run this async function, disable until it finishes.” Use **`useDynamicSubmitterFetcher`** when you want **reactive** fetcher fields in render without mirroring them into state.

### `ConcurrentSubmitterProvider` + `useConcurrentSubmitter`

Run multiple submissions in parallel via the framework fetcher; each is tracked in `operations` with `submittedData` (for optimistic UI) and `data` when done. Wrap your app (or subtree) with `ConcurrentSubmitterProvider`, then use `useConcurrentSubmitter<TInfo>()` for typed `submitJson` / `submitFormData` with path and args per call.

- **`submitJson(path, args, data, options?)`** — POST JSON to the given route; path/args are per call.
- **`submitFormData(path, args, formData, submittedData?, options?)`** — POST multipart/form-data. Optional `submittedData` is a serializable object for the operations list (e.g. `{ type: "upload", label: "photo.jpg" }`); FormData/File are not stored in state.

```tsx
// Root (e.g. root.tsx)
import { ConcurrentSubmitterProvider } from '@firtoz/router-toolkit';

export default function App() {
  return (
    <ConcurrentSubmitterProvider>
      <Outlet />
    </ConcurrentSubmitterProvider>
  );
}

// Any route or component
import { useConcurrentSubmitter } from '@firtoz/router-toolkit';

function UploadList() {
  const { operations, submitFormData } = useConcurrentSubmitter<
    typeof import("./api.upload")
  >();

  const handleUpload = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    submitFormData("/api/upload", undefined, fd, { type: "upload", label: file.name });
  };

  return (
    <ul>
      {Object.values(operations).map((op) => (
        <li key={op.id}>
          {op.status === "pending" && (
            <Skeleton>{(op.submittedData as { label?: string }).label}</Skeleton>
          )}
          {op.status === "done" && (
            <span>Saved: {op.data?.id}</span>
          )}
          {op.status === "error" && (
            <span>Failed: {String(op.error)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- **`operations`**: `Record<string, Operation<T>>` — each operation has `id`, `status` (`"pending"` | `"done"` | `"error"`), `submittedData` (payload or display object), and when done `data` (action response).
- **`submitJson(path, args, data, options?)`** / **`submitFormData(path, args, formData, submittedData?, options?)`**: each returns `{ id, promise }`. `submittedData` defaults to `{}` and is used only for display in the operations list.

### `useFetcherStateChanged`

Track changes in fetcher state and react to them. Perfect for triggering side effects, showing notifications, or handling state transitions in your application.

```tsx
// app/routes/notification-form.tsx
import {
  useDynamicSubmitter,
  useDynamicSubmitterFetcher,
  useFetcherStateChanged,
  type RoutePath,
} from '@firtoz/router-toolkit';
import { useState } from 'react';
import { z } from 'zod';
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
  const path = "/notification-form" as const;
  const submitter = useDynamicSubmitter<typeof import("./notification-form")>(path);
  const fetcher = useDynamicSubmitterFetcher(submitter);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Track fetcher state changes for side effects (pass the parallel fetcher, not submitter)
  useFetcherStateChanged(fetcher, (lastState, newState) => {
    console.log(`Fetcher state changed from ${lastState} to ${newState}`);
    
    // Show success notification when form submission completes
    if (newState === 'idle' && lastState === 'submitting') {
      if (fetcher.data?.success) {
        setNotifications(prev => [...prev, `✅ ${fetcher.data.message}`]);
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
          disabled={fetcher.state === 'submitting'}
        >
          {fetcher.state === 'submitting' ? 'Sending...' : 'Send Notification'}
        </button>
        
        <p>Current state: <strong>{fetcher.state}</strong></p>
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

## Form Action Utilities

### `formAction`

Type-safe form action wrapper that provides Zod validation and structured error handling for React Router actions. This utility integrates seamlessly with `useDynamicSubmitter` and the `formSchema` export pattern.

#### Features

- ✅ **Automatic form data validation** using Zod schemas
- 🛡️ **Type-safe error handling** with structured error types
- 🔄 **MaybeError integration** for consistent error patterns — import **`success`** / **`fail`** from [`@firtoz/maybe-error`](../maybe-error/README.md), not from router-toolkit (see [MaybeError Utility](#maybeerror-utility))
- 🚀 **React Router compatibility** preserves redirects and responses
- 📝 **Full TypeScript support** with inferred types from schemas

#### Basic Usage

```tsx
// app/routes/register.tsx
import { z } from "zod";
import { formAction, type RoutePath } from "@firtoz/router-toolkit";
import { success, fail } from "@firtoz/maybe-error";

// Export the schema for useDynamicSubmitter integration
export const formSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const action = formAction({
  schema: formSchema,
  handler: async (args, data) => {
    // data is fully typed based on the schema
    try {
      const user = await createUser({
        email: data.email,
        password: data.password,
      });
      
      return success({
        message: "Registration successful!",
        userId: user.id,
      });
    } catch (error) {
      return fail("Email already exists");
    }
  },
});

export const route: RoutePath<"/register"> = "/register";
```

#### Using with useDynamicSubmitter

The `formAction` utility works seamlessly with `useDynamicSubmitter` when you export a `formSchema`:

```tsx
// app/routes/register.tsx (component)
import {
  useDynamicSubmitter,
  useDynamicSubmitterFetcher,
} from "@firtoz/router-toolkit";

export default function Register() {
  const path = "/register" as const;
  const submitter = useDynamicSubmitter<typeof import("./register")>(path);
  const fetcher = useDynamicSubmitterFetcher(submitter);

  return (
    <submitter.Form method="post">
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <input name="confirmPassword" type="password" required />
      <button type="submit" disabled={fetcher.state === "submitting"}>
        {fetcher.state === "submitting" ? "Registering..." : "Register"}
      </button>
    </submitter.Form>
  );
}
```

#### Error Handling

The `formAction` utility returns structured errors. Inspect `fetcher.data` from `useDynamicSubmitterFetcher(submitter)`, or `await submitter.submitJson(...)` in an async handler:

```tsx
export default function Register() {
  const path = "/register" as const;
  const submitter = useDynamicSubmitter<typeof import("./register")>(path);
  const fetcher = useDynamicSubmitterFetcher(submitter);

  if (fetcher.data && !fetcher.data.success) {
    const error = fetcher.data.error;

    switch (error.type) {
      case "validation":
        console.log("Validation errors:", error.error);
        break;
      case "handler":
        console.log("Handler error:", error.error);
        break;
      case "unknown":
        console.log("Unknown error occurred");
        break;
    }
  }

  // Rest of component...
}
```

#### Error Types

The `formAction` utility returns three types of errors:

1. **Validation Errors** (`type: "validation"`)
   - Occurs when form data doesn't match the Zod schema
   - Contains detailed field-level validation errors from Zod
   - The `error.error` field contains the result of `z.treeifyError()`

2. **Handler Errors** (`type: "handler"`)
   - Occurs when your handler function returns a `fail()` result
   - Contains the custom error you provided to `fail()`
   - The `error.error` field contains your custom error value

3. **Unknown Errors** (`type: "unknown"`)
   - Occurs when an unexpected exception is thrown
   - Logs the error to console for debugging
   - Does not expose the raw error to avoid information leakage

#### Advanced Features

**File Uploads**

```tsx
const uploadSchema = z.object({
  title: z.string().min(1),
  file: z.instanceof(File),
  description: z.string().optional(),
});

export const action = formAction({
  schema: uploadSchema,
  handler: async (args, data) => {
    const uploadResult = await uploadFile(data.file, {
      title: data.title,
      description: data.description,
    });
    
    return success({ fileId: uploadResult.id });
  },
});
```

**Complex Validation**

```tsx
const complexSchema = z.object({
  user: z.object({
    name: z.string().min(2),
    age: z.coerce.number().min(18),
  }),
  preferences: z.object({
    newsletter: z.boolean().default(false),
    theme: z.enum(["light", "dark"]).default("light"),
  }),
  terms: z.literal("on", { 
    errorMap: () => ({ message: "You must accept the terms" }) 
  }),
});
```

**Redirects and Responses**

React Router `Response` objects (like redirects) are automatically preserved:

```tsx
export const action = formAction({
  schema: loginSchema,
  handler: async (args, data) => {
    const user = await authenticateUser(data.email, data.password);
    
    if (user) {
      // This redirect will be properly handled by React Router
      throw redirect("/dashboard");
    }
    
    return fail("Invalid credentials");
  },
});
```

#### Type Safety

The `formAction` utility provides full type safety:

- **Schema inference**: Form data is typed based on your Zod schema
- **Handler types**: Handler parameters are properly typed
- **Error types**: Error handling is type-safe with discriminated unions
- **Integration**: Works seamlessly with `useDynamicSubmitter` type inference

#### API Reference

```tsx
function formAction<
  TSchema extends z.ZodTypeAny,
  TResult = undefined,
  TError = string,
  ActionArgs extends ActionFunctionArgs = ActionFunctionArgs,
>(config: {
  schema: TSchema;
  handler: (
    args: ActionArgs, 
    data: z.infer<TSchema>
  ) => Promise<MaybeError<TResult, TError>>;
}): (args: ActionArgs) => Promise<MaybeError<TResult, FormActionError<TError>>>;

type FormActionError<TError> =
  | { type: "validation"; error: ReturnType<typeof z.treeifyError> }
  | { type: "handler"; error: TError }
  | { type: "unknown" };
```

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
import {
  useDynamicSubmitter,
  useDynamicSubmitterFetcher,
  type RoutePath,
} from '@firtoz/router-toolkit';
import { z } from 'zod';
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
  const path = "/action-test" as const;
  const submitter = useDynamicSubmitter<typeof import("./action-test")>(path);
  const fetcher = useDynamicSubmitterFetcher(submitter);

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
          disabled={fetcher.state === "submitting"}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {fetcher.state === "submitting" ? "Submitting..." : "Submit"}
        </button>
      </submitter.Form>

      {fetcher.data && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Action Result:</h2>
          <pre className="bg-gray-200 p-3 rounded text-sm text-gray-800">
            {JSON.stringify(fetcher.data, null, 2)}
          </pre>

          {fetcher.data.success ? (
            <div className="mt-4 p-3 bg-green-100 rounded">
              <p className="text-green-800">✅ {fetcher.data.message}</p>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-red-100 rounded">
              <p className="text-red-800">❌ {fetcher.data.message}</p>
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
  useDynamicSubmitter,
  useDynamicSubmitterFetcher,
  type RoutePath,
} from '@firtoz/router-toolkit';
import { useLoaderData } from 'react-router';
import { z } from 'zod';
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
  const path = "/combined-test" as const;
  const submitter = useDynamicSubmitter<typeof import("./combined-test")>(path);
  const actionFetcher = useDynamicSubmitterFetcher(submitter);

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
              disabled={actionFetcher.state === "submitting"}
              className="bg-purple-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {actionFetcher.state === "submitting" ? "Updating..." : "Update User"}
            </button>
          </submitter.Form>
        </div>
      </div>

      {/* Status Section */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Action Status:</h2>
        <pre className="bg-gray-200 p-3 rounded text-sm text-gray-800">
          {JSON.stringify({ state: actionFetcher.state }, null, 2)}
        </pre>
      </div>

      {actionFetcher.data && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Action Result:</h2>
          <pre className="bg-gray-200 p-3 rounded text-sm text-gray-800">
            {JSON.stringify(actionFetcher.data, null, 2)}
          </pre>

          {actionFetcher.data.success ? (
            <div className="mt-4 p-3 bg-green-100 rounded">
              <p className="text-green-800">✅ {actionFetcher.data.message}</p>
              {actionFetcher.data.updatedUser && (
                <p className="text-sm text-green-700 mt-1">
                  Tip: Reload the page to see if data persists (it won't in this demo)
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 p-3 bg-red-100 rounded">
              <p className="text-red-800">❌ {actionFetcher.data.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## MaybeError Utility

`@firtoz/maybe-error` is a **dependency** of router-toolkit (it is installed with this package), but it is **not** re-exported from `@firtoz/router-toolkit`. Import `success`, `fail`, `MaybeError`, `exhaustiveGuard`, and related symbols **from `@firtoz/maybe-error`** so your imports match runtime and dependency boundaries stay clear.

For the full API (`MaybeError`, `success`, `fail`, `exhaustiveGuard`, `AssumeSuccess`), see the [`@firtoz/maybe-error` README](../maybe-error/README.md).

### Basic Usage

```tsx
import { success, fail, type MaybeError } from '@firtoz/maybe-error';

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
import { success, fail, type MaybeError } from '@firtoz/maybe-error';
import { type RoutePath } from '@firtoz/router-toolkit';
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
import { success, fail, type MaybeError } from '@firtoz/maybe-error';
import {
  useDynamicSubmitter,
  useDynamicSubmitterFetcher,
  type RoutePath,
} from '@firtoz/router-toolkit';
import { z } from 'zod';
import type { Route } from './+types/create-user';

export const route: RoutePath<"/create-user"> = "/create-user";

export const formSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
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
  const path = "/create-user" as const;
  const submitter = useDynamicSubmitter<typeof import("./create-user")>(path);
  const fetcher = useDynamicSubmitterFetcher(submitter);

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
        
        <button type="submit" disabled={fetcher.state === "submitting"}>
          {fetcher.state === "submitting" ? "Creating..." : "Create User"}
        </button>
      </submitter.Form>

      {fetcher.data && (
        <div>
          {fetcher.data.success ? (
            <div className="success">
              <h3>User Created!</h3>
              <p>Name: {fetcher.data.result.name}</p>
              <p>Email: {fetcher.data.result.email}</p>
            </div>
          ) : (
            <div className="errors">
              <h3>Validation Errors:</h3>
              <ul>
                {fetcher.data.error.map((error, index) => (
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

See [`@firtoz/maybe-error` README](../maybe-error/README.md) for type definitions and utilities.

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
- Make sure you're using React Router 7.14+ or 8.x in framework mode
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

- Check the [React Router documentation](https://reactrouter.com) for framework mode setup
- Look at the test application in the `tests/` directory for working examples
- Open an issue on [GitHub](https://github.com/firtoz/fullstack-toolkit) if you find a bug

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [Firtina Ozbalikchi](https://github.com/firtoz)

## Links

- [GitHub Repository](https://github.com/firtoz/fullstack-toolkit)
- [NPM Package](https://npmjs.com/package/@firtoz/router-toolkit)
- [React Router Documentation](https://reactrouter.com) 