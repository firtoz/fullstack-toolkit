/**
 * @fileoverview Type-safe form action utility for React Router 7
 *
 * This module provides a wrapper for React Router actions that handles form data validation
 * using Zod schemas and provides structured error handling with MaybeError.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { formAction } from "@firtoz/router-toolkit";
 * import { success } from "@firtoz/maybe-error";
 *
 * const schema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 * });
 *
 * export const action = formAction({
 *   schema,
 *   handler: async (args, data) => {
 *     // data is fully typed based on the schema
 *     const user = await authenticateUser(data.email, data.password);
 *     return success(user);
 *   },
 * });
 * ```
 */

import { fail, type MaybeError } from "@firtoz/maybe-error";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";

/**
 * Error types that can be returned by formAction
 */
export type FormActionError<TError> =
	| {
			type: "validation";
			error: ReturnType<typeof z.treeifyError<z.ZodTypeAny>>;
	  }
	| {
			type: "handler";
			error: TError;
	  }
	| {
			type: "unknown";
	  };

/**
 * Configuration object for formAction
 *
 * @template TSchema - The Zod schema type for form validation
 * @template TResult - The success result type from the handler
 * @template TError - The error type that the handler can return
 * @template ActionArgs - The action function arguments type (defaults to ActionFunctionArgs)
 */
export interface FormActionConfig<
	TSchema extends z.ZodTypeAny,
	TResult = undefined,
	TError = string,
	ActionArgs extends ActionFunctionArgs = ActionFunctionArgs,
> {
	/**
	 * Zod schema to validate the form data against
	 */
	schema: TSchema;
	/**
	 * Handler function that processes the validated form data
	 *
	 * @param args - The original action function arguments
	 * @param data - The validated form data (typed according to the schema)
	 * @returns A promise that resolves to a MaybeError with the result or error
	 */
	handler: (
		args: ActionArgs,
		data: z.infer<TSchema>,
	) => Promise<MaybeError<TResult, TError>>;
}

/**
 * Creates a type-safe form action handler that validates form data and provides structured error handling.
 *
 * This function wraps a React Router action to:
 * 1. Parse and validate form data using a Zod schema
 * 2. Call the provided handler with validated data
 * 3. Return structured errors for validation failures, handler errors, or unknown errors
 * 4. Preserve React Router Response objects (redirects, etc.) by re-throwing them
 *
 * @template TSchema - The Zod schema type for form validation
 * @template TResult - The success result type from the handler (defaults to undefined)
 * @template TError - The error type that the handler can return (defaults to string)
 * @template ActionArgs - The action function arguments type (defaults to ActionFunctionArgs)
 *
 * @param config - Configuration object containing schema and handler
 * @returns An action function that can be used with React Router
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { formAction } from "@firtoz/router-toolkit";
 * import { success, fail } from "@firtoz/maybe-error";
 *
 * const loginSchema = z.object({
 *   email: z.string().email("Invalid email format"),
 *   password: z.string().min(8, "Password must be at least 8 characters"),
 * });
 *
 * export const action = formAction({
 *   schema: loginSchema,
 *   handler: async (args, data) => {
 *     try {
 *       const user = await authenticateUser(data.email, data.password);
 *       return success(user);
 *     } catch (error) {
 *       return fail("Invalid credentials");
 *     }
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // In your component, handle the different error types:
 * const actionData = useActionData<typeof action>();
 *
 * if (actionData && !actionData.success) {
 *   switch (actionData.error.type) {
 *     case "validation":
 *       // Handle validation errors - actionData.error.error contains field-specific errors
 *       break;
 *     case "handler":
 *       // Handle business logic errors - actionData.error.error contains your custom error
 *       break;
 *     case "unknown":
 *       // Handle unexpected errors
 *       break;
 *   }
 * }
 * ```
 */
export const formAction = <
	TSchema extends z.ZodTypeAny,
	TResult = undefined,
	TError = string,
	ActionArgs extends ActionFunctionArgs = ActionFunctionArgs,
>({
	schema,
	handler,
}: FormActionConfig<TSchema, TResult, TError, ActionArgs>) => {
	return async (
		args: ActionArgs,
	): Promise<MaybeError<TResult, FormActionError<TError>>> => {
		try {
			const rawFormData = await args.request.formData();
			const formData = await zfd.formData(schema).safeParseAsync(rawFormData);

			if (!formData.success) {
				return fail({
					type: "validation" as const,
					error: z.treeifyError<TSchema>(
						formData.error as z.core.$ZodError<TSchema>,
					),
				});
			}

			const handlerResult = await handler(args, formData.data);
			if (!handlerResult.success) {
				return fail({
					type: "handler" as const,
					error: handlerResult.error,
				});
			}

			return handlerResult;
		} catch (error) {
			// Re-throw Response objects (redirects, etc.) to preserve React Router behavior
			if (error instanceof Response) {
				throw error;
			}

			console.error("Unexpected error in formAction:", error);
			return fail({
				type: "unknown" as const,
			});
		}
	};
};
