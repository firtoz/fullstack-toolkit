# @firtoz/worker-helper

## 1.3.4

### Patch Changes

- [`ec365af`](https://github.com/firtoz/fullstack-toolkit/commit/ec365af8c17bcd7efc2b0cf9b3bed5225b853e72) Thanks [@firtoz](https://github.com/firtoz)! - Update dependencies

## 1.3.3

### Patch Changes

- [`8f3143f`](https://github.com/firtoz/fullstack-toolkit/commit/8f3143ff5d9953350d2388d46ea7c859e7dbeda5) Thanks [@firtoz](https://github.com/firtoz)! - Fix cf-typegen to only include wrangler.json and wrangler.jsonc files, excluding template files like .hbs. Also sort config paths for consistent ordering.

## 1.3.2

### Patch Changes

- [`70856f6`](https://github.com/firtoz/fullstack-toolkit/commit/70856f6b055d6d149ee1edc703a5c2acf451be4a) Thanks [@firtoz](https://github.com/firtoz)! - Fix wrangler json finding

## 1.3.1

### Patch Changes

- [`07b8aec`](https://github.com/firtoz/fullstack-toolkit/commit/07b8aecc1e3ecde6ed497965c2c40770b85a341d) Thanks [@firtoz](https://github.com/firtoz)! - Use bun for cf-typegen instead of node

## 1.3.0

### Minor Changes

- [`ef2b36e`](https://github.com/firtoz/fullstack-toolkit/commit/ef2b36e4be4fda049f02f1d000649e4c75ff08ec) Thanks [@firtoz](https://github.com/firtoz)! - Export `cf-typegen` as a CLI binary. Users can now run `cf-typegen $(pwd)` directly after installing the package as a dev dependency.

## 1.2.0

### Minor Changes

- [`2725815`](https://github.com/firtoz/fullstack-toolkit/commit/27258158dd318b34b44ed77b88b2ac9b2b4b6a3d) Thanks [@firtoz](https://github.com/firtoz)! - Improved workspace-wide type generation and environment setup

  - Refactored `cf-typegen.ts` to automatically discover all wrangler configs using `git ls-files`
  - Uses git for workspace discovery - fast, respects .gitignore, and finds all tracked configs
  - Added `prepareEnvFiles` utility to handle .env file creation from .env.example templates
  - Type generation now includes bindings from all workspace projects for better DX

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
