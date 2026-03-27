---
name: strict-types-no-escape-hatches
description: Enforce strict TypeScript typing without escape hatches. Never use `any`, `as never`, or similar casts to bypass type safety.
---

# Strict Types: No Escape Hatches

Use this skill for all TypeScript code changes.

## Hard Rules

- Never use `any`
- Never use `as any`
- Never use `as never`
- Never use double-casts like `as unknown as T`
- Never use `@ts-ignore` / `@ts-expect-error` to bypass real typing issues

If a change appears to require one of these, stop and model the types correctly.

## Preferred Fixes

1. Tighten generics and constraints
2. Introduce explicit interfaces/types for shape contracts
3. Use discriminated unions and exhaustive switches
4. Narrow with runtime checks (`typeof`, `in`, predicate functions)
5. Split overloaded logic into typed helper functions
6. Adjust API signatures so callers do not need unsafe casts

## Review Checklist

Before finishing, verify:

- No `any` in changed files
- No `as never` in changed files
- No double-casts (`as unknown as`)
- No TypeScript suppression comments added
- `typecheck` passes without suppression

## When to Use

Always use this skill when:

- Adding/modifying TypeScript files
- Touching public package APIs
- Working with TanStack/Drizzle generics
- Refactoring sync protocol or bridge types
