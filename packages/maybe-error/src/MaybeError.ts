/**
 * @fileoverview Type-safe error handling utilities using discriminated unions
 *
 * This module provides a Result-like pattern for handling operations that may fail,
 * inspired by Rust's Result type and functional programming error handling patterns.
 * Compatible with TypeScript 5.0+ for optimal type inference.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = success(42);
 * const error = fail("Something went wrong");
 *
 * // Type-safe error handling
 * function divide(a: number, b: number): MaybeError<number> {
 *   if (b === 0) return fail("Division by zero");
 *   return success(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.success) {
 *   console.log(result.result); // 5
 * } else {
 *   console.error(result.error); // "Division by zero"
 * }
 * ```
 */

/**
 * Represents a failed operation with an error value.
 *
 * @template TError - The type of the error value (defaults to string)
 * @example
 * ```typescript
 * const error: DefiniteError<string> = { success: false, error: "Not found" };
 * const customError: DefiniteError<{code: number, message: string}> = {
 *   success: false,
 *   error: { code: 404, message: "Resource not found" }
 * };
 * ```
 */
export type DefiniteError<TError = string> = {
	success: false;
	error: TError;
};

/**
 * Represents a successful operation with an optional result value.
 *
 * Uses conditional types to make the result field optional when T is undefined,
 * but required when T has a concrete type.
 *
 * @template T - The type of the success value (defaults to undefined)
 * @example
 * ```typescript
 * const voidSuccess: DefiniteSuccess = { success: true };
 * const valueSuccess: DefiniteSuccess<number> = { success: true, result: 42 };
 * ```
 */
export type DefiniteSuccess<T = undefined> = {
	success: true;
} & (T extends undefined
	? {
			result?: T;
		}
	: {
			result: T;
		});

/**
 * A discriminated union representing either a successful result or an error.
 *
 * This is the main type for operations that may fail. The `success` field
 * acts as a discriminant, allowing TypeScript to narrow the type in conditionals.
 *
 * @template T - The type of the success value (defaults to undefined)
 * @template TError - The type of the error value (defaults to string)
 * @example
 * ```typescript
 * function fetchUser(id: string): MaybeError<User, ApiError> {
 *   // Implementation that returns either success(user) or fail(apiError)
 * }
 *
 * const result = fetchUser("123");
 * if (result.success) {
 *   // TypeScript knows result.result is User
 *   console.log(result.result.name);
 * } else {
 *   // TypeScript knows result.error is ApiError
 *   console.error(result.error.message);
 * }
 * ```
 */
export type MaybeError<T = undefined, TError = string> =
	| DefiniteSuccess<T>
	| DefiniteError<TError>;

/**
 * Utility type to extract the success value type from a MaybeError type.
 *
 * Useful for type manipulation when you need to work with the success type
 * without the error handling wrapper.
 *
 * @template T - A MaybeError type
 * @example
 * ```typescript
 * type UserResult = MaybeError<User, string>;
 * type UserType = AssumeSuccess<UserResult>; // User
 * ```
 */
export type AssumeSuccess<T extends MaybeError<unknown>> = Exclude<
	T,
	undefined
> extends MaybeError<infer U>
	? U
	: never;

/**
 * Creates a successful result with an optional value.
 *
 * Uses function overloading to provide different signatures based on whether
 * a value is provided or not.
 *
 * @template T - The type of the success value
 * @param params - The success value (optional for void operations)
 * @returns A DefiniteSuccess instance
 * @example
 * ```typescript
 * const voidResult = success(); // DefiniteSuccess<undefined>
 * const valueResult = success(42); // DefiniteSuccess<number>
 * const stringResult = success("hello"); // DefiniteSuccess<string>
 * ```
 */
export const success = <T = undefined>(
	...params: T extends undefined ? [] : [T]
): DefiniteSuccess<T> => {
	if (params.length === 0) {
		return { success: true } as unknown as DefiniteSuccess<T>;
	}

	return {
		success: true,
		result: params[0],
	} as unknown as DefiniteSuccess<T>;
};

/**
 * Creates a failed result with an error value.
 *
 * @template TError - The type of the error value
 * @param error - The error value
 * @returns A DefiniteError instance
 * @example
 * ```typescript
 * const stringError = fail("Something went wrong");
 * const objectError = fail({ code: 500, message: "Internal server error" });
 * const customError = fail(new Error("Custom error"));
 * ```
 */
export const fail = <TError = string>(error: TError): DefiniteError<TError> => {
	return {
		success: false,
		error,
	};
};
