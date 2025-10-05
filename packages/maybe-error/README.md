# @firtoz/maybe-error

[![npm version](https://img.shields.io/npm/v/%40firtoz%2Fmaybe-error.svg)](https://www.npmjs.com/package/@firtoz/maybe-error)
[![npm downloads](https://img.shields.io/npm/dm/%40firtoz%2Fmaybe-error.svg)](https://www.npmjs.com/package/@firtoz/maybe-error)
[![license](https://img.shields.io/npm/l/%40firtoz%2Fmaybe-error.svg)](https://github.com/firtoz/fullstack-toolkit/blob/main/LICENSE)

Type-safe result handling with the MaybeError pattern for TypeScript. Perfect for elegant error handling without exceptions.

## Features

- ✅ **Type-safe error handling** - Full TypeScript support with discriminated unions
- 🚀 **Zero dependencies** - Lightweight and fast
- 📦 **Tree-shakeable** - Import only what you need
- 🎯 **Simple API** - Easy to use and understand

## Installation

```bash
npm install @firtoz/maybe-error
# or
yarn add @firtoz/maybe-error
# or
pnpm add @firtoz/maybe-error
# or
bun add @firtoz/maybe-error
```

## Usage

### Basic Usage

```typescript
import { MaybeError, success, fail } from '@firtoz/maybe-error';

// Function that might fail
function divide(a: number, b: number): MaybeError<number> {
  if (b === 0) {
    return fail("Division by zero");
  }
  return success(a / b);
}

// Usage
const result = divide(10, 2);

if (result.success) {
  console.log("Result:", result.result); // TypeScript knows result exists
} else {
  console.error("Error:", result.error); // TypeScript knows error exists
}
```

### With Custom Error Types

```typescript
import { MaybeError, success, fail } from '@firtoz/maybe-error';

type ValidationError = {
  field: string;
  message: string;
};

function validateEmail(email: string): MaybeError<string, ValidationError> {
  if (!email.includes('@')) {
    return fail({
      field: 'email',
      message: 'Email must contain @ symbol'
    });
  }
  return success(email);
}

const result = validateEmail("user@example.com");

if (result.success) {
  console.log("Valid email:", result.result);
} else {
  console.error(`Validation error in ${result.error.field}: ${result.error.message}`);
}
```

### Async Functions

```typescript
import { MaybeError, success, fail } from '@firtoz/maybe-error';

async function fetchUser(id: string): Promise<MaybeError<User, string>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      return fail(`HTTP ${response.status}: ${response.statusText}`);
    }
    const user = await response.json();
    return success(user);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Unknown error');
  }
}

// Usage
const userResult = await fetchUser("123");
if (userResult.success) {
  console.log("User:", userResult.result);
} else {
  console.error("Failed to fetch user:", userResult.error);
}
```

## API Reference

### Types

#### `MaybeError<T, TError>`

A discriminated union type representing either success or failure.

```typescript
type MaybeError<T = undefined, TError = string> = 
  | DefiniteSuccess<T> 
  | DefiniteError<TError>;
```

#### `DefiniteSuccess<T>`

Represents a successful result.

```typescript
type DefiniteSuccess<T = undefined> = {
  success: true;
} & (T extends undefined ? { result?: T } : { result: T });
```

#### `DefiniteError<TError>`

Represents a failed result.

```typescript
type DefiniteError<TError = string> = {
  success: false;
  error: TError;
};
```

#### `AssumeSuccess<T>`

Utility type to extract the success type from a MaybeError.

```typescript
type AssumeSuccess<T extends MaybeError<unknown>> = // extracted success type
```

### Functions

#### `success<T>(result?: T): DefiniteSuccess<T>`

Creates a success result.

```typescript
const result1 = success(); // No result value
const result2 = success("Hello"); // With result value
const result3 = success({ id: 1, name: "John" }); // With object result
```

#### `fail<TError>(error: TError): DefiniteError<TError>`

Creates a failure result.

```typescript
const error1 = fail("Something went wrong");
const error2 = fail({ code: 404, message: "Not found" });
const error3 = fail(new Error("Custom error"));
```

## Examples

### Chaining Operations

```typescript
import { MaybeError, success, fail } from '@firtoz/maybe-error';

function parseNumber(str: string): MaybeError<number> {
  const num = Number(str);
  if (isNaN(num)) {
    return fail(`"${str}" is not a valid number`);
  }
  return success(num);
}

function sqrt(num: number): MaybeError<number> {
  if (num < 0) {
    return fail("Cannot calculate square root of negative number");
  }
  return success(Math.sqrt(num));
}

// Chain operations
function parseAndSqrt(str: string): MaybeError<number> {
  const parseResult = parseNumber(str);
  if (!parseResult.success) {
    return parseResult; // Forward the error
  }
  
  return sqrt(parseResult.result);
}

// Usage
const result = parseAndSqrt("16");
if (result.success) {
  console.log("Square root:", result.result); // 4
} else {
  console.error("Error:", result.error);
}
```

### With Promise.all

```typescript
import { MaybeError, success, fail } from '@firtoz/maybe-error';

async function fetchMultipleUsers(ids: string[]): Promise<MaybeError<User[]>> {
  try {
    const promises = ids.map(id => fetchUser(id));
    const results = await Promise.all(promises);
    
    // Check if any failed
    const errors = results.filter(r => !r.success);
    if (errors.length > 0) {
      return fail(`Failed to fetch ${errors.length} users`);
    }
    
    // All succeeded, extract results
    const users = results.map(r => r.success ? r.result : null).filter(Boolean);
    return success(users as User[]);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Unknown error');
  }
}
```

## Contributing

Contributions are welcome! This package is part of the [fullstack-toolkit monorepo](https://github.com/firtoz/fullstack-toolkit).

## License

MIT © [Firtina Ozbalikchi](https://github.com/firtoz) 