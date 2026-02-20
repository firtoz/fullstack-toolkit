---
name: exhaustive-switches
description: Use switch statements with an exhaustive default for discriminated unions and enum-like types. Use when handling union types with a discriminant (e.g. type field), message shapes, or variant types.
---

# Exhaustive Switches for Discriminated Unions

## When to Use

- Handling **discriminated unions** (union types with a common discriminant, e.g. `type: "insert" | "update" | "delete"`)
- **Enum-like scenarios** where you branch on a fixed set of values
- **Message/event payloads** with a `type` or `kind` field
- Any union where you want **compile-time exhaustiveness**: adding a new variant forces you to handle it

## Instructions

1. Use a **switch** on the discriminant (e.g. `msg.type`, `event.kind`), not a chain of `if / else if / else`.
2. In the **default** branch, call **`exhaustiveGuard(value)`** from `@firtoz/maybe-error`. It is typed as `(value: never): never`, so TypeScript will error if a variant is missing from the switch. At runtime it throws with the unexpected value.
3. Order cases for readability; put the default last.

## Pattern

Use the shared helper from `@firtoz/maybe-error`:

```typescript
import { exhaustiveGuard } from "@firtoz/maybe-error";

type Message =
  | { type: "insert"; value: T }
  | { type: "update"; value: T; previousValue: T }
  | { type: "delete"; key: string }
  | { type: "truncate" };

function handle(msg: Message) {
  switch (msg.type) {
    case "insert":
      doInsert(msg.value);
      break;
    case "update":
      doUpdate(msg.value, msg.previousValue);
      break;
    case "delete":
      doDelete(msg.key);
      break;
    case "truncate":
      doTruncate();
      break;
    default:
      exhaustiveGuard(msg);
  }
}
```

## Why the helper

- **Single place**: Same exhaustive guard behavior and error message across the repo.
- **Exhaustiveness**: `exhaustiveGuard(value: never)` forces the default branch to only be reachable when all variants are handled; adding a new variant causes a compile error on `msg`.

## Why Not if/else if/else

- With `if (msg.type === "insert") ... else if (...) else { ... }`, the final `else` also catches any future variant you forget to handle, and TypeScript won’t error.
- A switch with `default: exhaustiveGuard(msg)` gives a compile error when a new variant is added.
