---
name: strict-types-no-escape-hatches
description: Enforce strict TypeScript typing without escape hatches. Never use `any`, `as` casts to bypass the compiler, or similar workarounds—find the proper typed solution instead.
---

# Strict Types: No Escape Hatches

Use this skill for all TypeScript code changes.

## Red flag: `x as …`

**Whenever you reach for `value as SomeType`, treat it as a smell** — not a default fix.

A cast tells the compiler to trust you instead of proving the shape. That often hides:

- A dependency/API change (e.g. a field removed from upstream types)
- A wrong assumption about runtime data
- Missing generics, overloads, or narrowing

**Before adding any `as` cast, stop and find the proper solution:**

1. Read the **real** type from the owning package (imports, generated `+types`, `.d.ts`).
2. Use the **documented** API surface — do not invent parallel shapes with casts.
3. Prefer **generics, interfaces, discriminated unions, and runtime narrowing** over assertion.
4. If upstream types are wrong for your use case, **fix types at the source** (better generic bound, helper type, wrapper) rather than casting at the call site.
5. If the runtime contract truly changed (e.g. RR8 removed `fetcher.error`), **update behavior** to match the new model — do not cast to resurrect the old field.

### Allowed exceptions (not “escape hatches”)

- `as const` for literal widening
- Casts **immediately after** a runtime check you wrote (prefer a type predicate / `satisfies` when possible)
- Rare interop at a single boundary — must include a one-line comment explaining why narrowing is impossible and what invariant holds

Everything else — especially `as any`, `as never`, `as unknown as T`, and **ad-hoc object casts** like `(fetcher as { error?: unknown })` — is forbidden.

## Hard Rules

- Never use `any`
- Never use `as any`
- Never use `as never`
- Never use double-casts like `as unknown as T`
- Never use `@ts-ignore` / `@ts-expect-error` to bypass real typing issues
- Never use `as SomeType` to access properties or methods the type system says are missing

If a change appears to require one of these, stop and model the types correctly.

## Preferred Fixes

1. Tighten generics and constraints
2. Introduce explicit interfaces/types for shape contracts
3. Use discriminated unions and exhaustive switches
4. Narrow with runtime checks (`typeof`, `in`, predicate functions)
5. Split overloaded logic into typed helper functions
6. Adjust API signatures so callers do not need unsafe casts
7. Align implementation with upstream API changes instead of casting around them

## Review Checklist

Before finishing, verify:

- No `any` in changed files
- No `as never` in changed files
- No double-casts (`as unknown as`)
- No ad-hoc `as { … }` casts to “add” fields upstream removed or never exposed
- No TypeScript suppression comments added
- `typecheck` passes without suppression

## When to Use

Always use this skill when:

- Adding/modifying TypeScript files
- Touching public package APIs
- Working with TanStack/Drizzle generics
- Refactoring sync protocol or bridge types
