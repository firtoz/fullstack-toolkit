# @firtoz/worker-helper

Type-safe Web Worker helper with Zod validation for input and output messages. This package provides a simple way to create type-safe Web Workers with automatic validation of messages sent between the main thread and worker threads.

> **⚠️ Early WIP Notice:** This package is in very early development and is **not production-ready**. It is TypeScript-only and may have breaking changes. While I (the maintainer) have limited time, I'm open to PRs for features, bug fixes, or additional support (like JS builds). Please feel free to try it out and contribute! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

## Features

### Web Workers

- 🔒 **Type-safe**: Full TypeScript support with automatic type inference
- ✅ **Zod Validation**: Automatic validation of both input and output messages
- 🎯 **Custom Error Handlers**: Mandatory error handlers give you complete control over error handling
- 🔄 **Async Support**: Built-in support for async message handlers
- 🧩 **Discriminated Unions**: Works great with Zod's discriminated unions for type-safe message routing

### Cloudflare Workers

- 🔧 **cf-typegen**: Automatic `.env.local` creation from `wrangler.jsonc` vars
- 📝 **Type Generation**: Wrapper around `wrangler types` with env preparation

## Installation

```bash
bun add @firtoz/worker-helper zod
```

## cf-typegen (Cloudflare Workers Utility)

Automatic TypeScript type generation and `.env.local` management for Cloudflare Workers projects.

### Setup

Add the script to your Cloudflare Workers package:

```json
{
  "scripts": {
    "cf-typegen": "bun --cwd ../../packages/worker-helper cf-typegen $(pwd)"
  }
}
```

### What It Does

1. **Reads `.env.local.example`** to find required env vars
2. **Creates/updates `.env.local`** with any missing vars (as empty strings)
3. **Runs `wrangler types`** to generate TypeScript definitions

### Example

```bash
cd your-worker-package
bun run cf-typegen
```

**Output:**
```
Running CF typegen for: /path/to/your-worker
✓ Added missing env vars: OPENROUTER_API_KEY, DATABASE_URL
Running wrangler types...
✓ Wrangler types generated
✓ CF typegen completed successfully
```

**Generated `.env.local`:**
```env
OPENROUTER_API_KEY=
DATABASE_URL=
```

### Why This Matters

- Ensures `wrangler types` always succeeds (needs `.env.local` or `.dev.vars`)
- Keeps `.env.local` in sync with `.env.local.example`
- Avoids accidentally binding empty vars at runtime via `wrangler.jsonc` `vars`
- Developers can fill in actual values without committing them to git
- CI/CD can generate types without needing actual secrets
- `.env.local.example` serves as documentation for required env vars

## Web Worker Usage

### 1. Define Your Schemas

First, define Zod schemas for your input and output messages:

```typescript
import { z } from "zod";

const InputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add"),
    a: z.number(),
    b: z.number(),
  }),
  z.object({
    type: z.literal("multiply"),
    a: z.number(),
    b: z.number(),
  }),
]);

const OutputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("result"),
    value: z.number(),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
]);

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;
```

### 2. Create Your Worker

Create a worker file (e.g., `worker.ts`):

```typescript
import { WorkerHelper } from "@firtoz/worker-helper";
import { InputSchema, OutputSchema, type Input, type Output } from "./schemas";

// Declare self as Worker for TypeScript
declare var self: Worker;

new WorkerHelper<Input, Output>(self, InputSchema, OutputSchema, {
  // Handle validated messages
  handleMessage: (data, send) => {
    switch (data.type) {
      case "add":
        send({
          type: "result",
          value: data.a + data.b,
        });
        break;

      case "multiply":
        send({
          type: "result",
          value: data.a * data.b,
        });
        break;
    }
  },

  // Handle input validation errors
  handleInputValidationError: (error, originalData) => {
    console.error("Invalid input received:", error);
    self.postMessage({
      type: "error",
      message: `Invalid input: ${error.message}`,
    });
  },

  // Handle output validation errors
  handleOutputValidationError: (error, originalData) => {
    console.error("Invalid output attempted:", error);
    self.postMessage({
      type: "error",
      message: `Internal error: invalid output`,
    });
  },

  // Handle processing errors
  handleProcessingError: (error, validatedData) => {
    console.error("Processing error:", error);
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({
      type: "error",
      message: `Processing failed: ${message}`,
    });
  },
});
```

### 3. Use Your Worker

In your main thread:

```typescript
// Worker is a global in Bun, no need to import
const worker = new Worker(new URL("./worker.ts", import.meta.url).href);

// Send a message
worker.postMessage({
  type: "add",
  a: 5,
  b: 3,
});

// Receive messages
worker.on("message", (result) => {
  if (result.type === "result") {
    console.log("Result:", result.value); // 8
  } else if (result.type === "error") {
    console.error("Error:", result.message);
  }
});

// Clean up
worker.on("exit", () => {
  console.log("Worker exited");
});
```

## API

### `WorkerHelper<TInput, TOutput>`

The main class that manages worker message handling with validation.

#### Constructor Parameters

- `self: MessageTarget` - The worker's `self` object (or `parentPort` for Node.js compatibility)
- `inputSchema: ZodType<TInput>` - Zod schema for validating incoming messages
- `outputSchema: ZodType<TOutput>` - Zod schema for validating outgoing messages
- `handlers: WorkerHelperHandlers<TInput, TOutput>` - Object containing all message and error handlers

### `WorkerHelperHandlers<TInput, TOutput>`

Interface defining all required handlers:

```typescript
type WorkerHelperHandlers<TInput, TOutput> = {
  // Handle validated messages
  handleMessage: (
    data: TInput,
    send: (response: TOutput) => void,
  ) => void | Promise<void>;

  // Handle input validation errors
  handleInputValidationError: (
    error: ZodError<TInput>,
    originalData: unknown,
  ) => void | Promise<void>;

  // Handle output validation errors
  handleOutputValidationError: (
    error: ZodError<TOutput>,
    originalData: TOutput,
  ) => void | Promise<void>;

  // Handle processing errors (exceptions thrown in handleMessage)
  handleProcessingError: (
    error: unknown,
    validatedData: TInput,
  ) => void | Promise<void>;
};
```

## Advanced Usage

### Async Message Handling

All handlers support both synchronous and asynchronous operations:

```typescript
new WorkerHelper<Input, Output>(self, InputSchema, OutputSchema, {
  handleMessage: async (data, send) => {
    // Perform async operations
    const result = await someAsyncOperation(data);
    send(result);
  },

  handleInputValidationError: async (error, originalData) => {
    // Log to remote service
    await logError(error);
    self.postMessage({ type: "error", message: "Invalid input" });
  },

  // ... other handlers
});
```

### Complex Message Types

Use discriminated unions for type-safe message routing:

```typescript
const InputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("compute"),
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    operands: z.array(z.number()),
  }),
  z.object({
    type: z.literal("status"),
  }),
  z.object({
    type: z.literal("config"),
    settings: z.record(z.string(), z.unknown()),
  }),
]);

// TypeScript will narrow the type based on the discriminator
handleMessage: (data, send) => {
  switch (data.type) {
    case "compute":
      // data is narrowed to { type: "compute", operation: ..., operands: ... }
      break;
    case "status":
      // data is narrowed to { type: "status" }
      break;
    case "config":
      // data is narrowed to { type: "config", settings: ... }
      break;
  }
};
```

### Custom Error Responses

You have full control over how errors are communicated back to the main thread:

```typescript
handleInputValidationError: (error, originalData) => {
  // Send structured error response
  self.postMessage({
    type: "error",
    code: "VALIDATION_ERROR",
    details: error.issues,
    timestamp: Date.now(),
  });
},

handleProcessingError: (error, validatedData) => {
  // Send error with context
  self.postMessage({
    type: "error",
    code: "PROCESSING_ERROR",
    message: error instanceof Error ? error.message : String(error),
    input: validatedData.type, // Include relevant context
  });
},
```

## Error Handling

The WorkerHelper validates messages at three key points:

1. **Input Validation**: Before your handler receives a message, it's validated against the input schema. If validation fails, `handleInputValidationError` is called.

2. **Output Validation**: Before a message is sent from the worker, it's validated against the output schema. If validation fails, `handleOutputValidationError` is called.

3. **Processing Errors**: If your `handleMessage` handler throws an error, `handleProcessingError` is called.

All error handlers are **mandatory**, ensuring you handle all error cases explicitly.

## Best Practices

1. **Use Discriminated Unions**: They provide type-safe message routing and better error messages.

2. **Keep Schemas Strict**: Use strict schemas to catch errors early.

3. **Log Errors Appropriately**: Use error handlers to log errors to your monitoring system.

4. **Don't Swallow Errors**: Always communicate errors back to the main thread in some form.

5. **Test Error Cases**: Use the error handlers to test how your application handles invalid inputs and processing errors.

## Testing

The package includes comprehensive tests. Run them with:

```bash
bun test
```

See the test files for examples of testing workers with different scenarios:
- Valid message handling
- Input validation errors
- Output validation errors
- Processing errors
- Async operations
- Edge cases

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related Packages

- [@firtoz/maybe-error](../maybe-error) - Type-safe error handling pattern
- [@firtoz/hono-fetcher](../hono-fetcher) - Type-safe Hono API client
- [@firtoz/websocket-do](../websocket-do) - Type-safe WebSocket Durable Objects

## Support

For issues and questions, please file an issue on [GitHub](https://github.com/firtoz/fullstack-toolkit/issues).

