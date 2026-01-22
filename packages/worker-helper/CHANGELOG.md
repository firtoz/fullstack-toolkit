# @firtoz/worker-helper

## 1.1.0

### Minor Changes

- [`b0f7893`](https://github.com/firtoz/fullstack-toolkit/commit/b0f789314c4ee85d8c08466b968baad2977a2581) Thanks [@firtoz](https://github.com/firtoz)! - Added cf-typegen script utility for generating Cloudflare Workers TypeScript types

  - Added cf-typegen script that runs wrangler types command for specified worker directory
  - Utility used by test packages to generate worker-configuration.d.ts
  - Simplified type generation workflow for Cloudflare Workers projects

## 1.0.0

### Major Changes

- [#22](https://github.com/firtoz/fullstack-toolkit/pull/22) [`cf12782`](https://github.com/firtoz/fullstack-toolkit/commit/cf1278236e484e6350eb614ce2381e0afcec326e) Thanks [@firtoz](https://github.com/firtoz)! - Initial release of `@firtoz/worker-helper` - Type-safe Web Worker communication with Zod validation for both client and worker sides.

  > **⚠️ Early WIP Notice:** This package is in very early development and is **not production-ready**. It is TypeScript-only and may have breaking changes. While I (the maintainer) have limited time, I'm open to PRs for features, bug fixes, or additional support (like JS builds). Please feel free to try it out and contribute! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

  ## Worker-Side (`WorkerHelper`)

  - **Abstract class pattern** for creating type-safe workers
  - **Zod validation** for both incoming and outgoing messages
  - **Mandatory error handlers** give complete control over error handling:
    - `handleMessage` - Process validated messages
    - `handleInputValidationError` - Handle input validation failures
    - `handleOutputValidationError` - Handle output validation failures
    - `handleProcessingError` - Handle runtime errors
  - **Full async support** - All handlers support both sync and async operations
  - **Type-safe `send()` method** - Automatically validates before sending
  - Uses Bun's global `Worker` and `self` patterns

  ## Client-Side (`WorkerClient`)

  - **Type-safe wrapper** for Worker instances
  - **Validates messages** sent TO the worker (client → worker)
  - **Validates messages** received FROM the worker (worker → client)
  - **Optional callbacks**:
    - `onMessage` - Receive validated messages
    - `onValidationError` - Handle validation failures
    - `onError` - Handle worker errors
  - **Worker lifecycle management** with `terminate()` and `getWorker()`
  - Accepts existing Worker instances for maximum flexibility

  ## Features

  - Full TypeScript support with automatic type inference
  - Works with discriminated unions for type-safe message routing
  - Comprehensive test suite with 33 tests (18 for WorkerHelper, 15 for WorkerClient)
  - Tests include async operations, validation errors, and error handling
  - Uses `.worker.ts` extension convention for worker files
  - Zero dependencies except Zod
  - Built for Bun's Worker API

  ## Example

  ```typescript
  // Define schemas
  const InputSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("add"), a: z.number(), b: z.number() }),
  ]);

  const OutputSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("result"), value: z.number() }),
  ]);

  // Worker side (worker.worker.ts)
  declare var self: Worker;

  class MyWorker extends WorkerHelper<Input, Output> {
    constructor() {
      super(self, InputSchema, OutputSchema, {
        handleMessage: (data) => {
          if (data.type === "add") {
            this.send({ type: "result", value: data.a + data.b });
          }
        },
        handleInputValidationError: (error, originalData) => {
          console.error("Invalid input:", error);
        },
        // ... other handlers
      });
    }
  }

  new MyWorker();

  // Client side
  const worker = new Worker(
    new URL("./worker.worker.ts", import.meta.url).href
  );

  const client = new WorkerClient({
    worker,
    clientSchema: InputSchema,
    serverSchema: OutputSchema,
    onMessage: (msg) => console.log("Result:", msg.value),
  });

  client.send({ type: "add", a: 5, b: 3 }); // Type-safe!
  ```
