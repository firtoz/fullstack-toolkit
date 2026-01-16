/**
 * @fileoverview Type-safe form action utility for React Router 7
 *
 * This module provides a wrapper for React Router actions that handles form data validation
 * using Zod schemas and provides structured error handling with MaybeError.
 *
 * ## Overview
 *
 * `formAction` is designed to work seamlessly with `useDynamicSubmitter` and `useDynamicFetcher`
 * to provide end-to-end type safety for your React Router forms.
 *
 * @example
 * ### Basic Route Setup (`app/routes/auth.login.tsx`)
 *
 * ```typescript
 * import { z } from "zod";
 * import { formAction, type RoutePath } from "@firtoz/router-toolkit";
 * import { success, fail } from "@firtoz/maybe-error";
 *
 * // 1. Export the route path for type inference
 * export const route: RoutePath<"/auth/login"> = "/auth/login";
 *
 * // 2. Define your form schema with Zod
 * export const formSchema = z.object({
 *   email: z.string().email("Please enter a valid email"),
 *   password: z.string().min(8, "Password must be at least 8 characters"),
 *   rememberMe: z.boolean().optional().default(false),
 * });
 *
 * // 3. Create the action with formAction
 * export const action = formAction({
 *   schema: formSchema,
 *   handler: async ({ request }, data) => {
 *     // data is fully typed: { email: string, password: string, rememberMe: boolean }
 *     try {
 *       const user = await authenticateUser(data.email, data.password);
 *       if (data.rememberMe) {
 *         await createPersistentSession(user.id);
 *       }
 *       return success({ user });
 *     } catch (error) {
 *       return fail("Invalid email or password");
 *     }
 *   },
 * });
 * ```
 *
 * @example
 * ### Using with useDynamicSubmitter
 *
 * The route above can be used with `useDynamicSubmitter` for type-safe form submissions:
 *
 * ```tsx
 * import { useDynamicSubmitter } from "@firtoz/router-toolkit";
 *
 * function LoginForm() {
 *   const submitter = useDynamicSubmitter<typeof import("./auth.login")>("/auth/login");
 *
 *   // Option 1: Submit as JSON (recommended for programmatic use)
 *   const handleLoginJson = async () => {
 *     await submitter.submitJson(
 *       { email: "user@example.com", password: "secret123", rememberMe: true },
 *       { method: "POST" }
 *     );
 *   };
 *
 *   // Option 2: Use the Form component
 *   return (
 *     <submitter.Form method="POST">
 *       <input name="email" type="email" placeholder="Email" />
 *       <input name="password" type="password" placeholder="Password" />
 *       <label>
 *         <input name="rememberMe" type="checkbox" /> Remember me
 *       </label>
 *       <button disabled={submitter.state !== "idle"}>
 *         {submitter.state === "submitting" ? "Logging in..." : "Login"}
 *       </button>
 *
 *       {submitter.data && !submitter.data.success && (
 *         <div className="error">
 *           {submitter.data.error.type === "validation"
 *             ? "Please check your inputs"
 *             : submitter.data.error.type === "handler"
 *               ? submitter.data.error.error // "Invalid email or password"
 *               : "An unexpected error occurred"}
 *         </div>
 *       )}
 *     </submitter.Form>
 *   );
 * }
 * ```
 *
 * @example
 * ### Combined loader + action route (`app/routes/admin.posts.$id.tsx`)
 *
 * You can combine `formAction` with a loader for full CRUD operations:
 *
 * ```typescript
 * import { z } from "zod";
 * import { formAction, type RoutePath } from "@firtoz/router-toolkit";
 * import { success, fail } from "@firtoz/maybe-error";
 * import type { LoaderFunctionArgs } from "react-router";
 *
 * export const route: RoutePath<"/admin/posts/:id"> = "/admin/posts/:id";
 *
 * // Loader for fetching data (used with useDynamicFetcher)
 * export const loader = async ({ params }: LoaderFunctionArgs) => {
 *   const post = await db.posts.findUnique({ where: { id: params.id } });
 *   return { post };
 * };
 *
 * // Form schema for updates
 * export const formSchema = z.object({
 *   title: z.string().min(1, "Title is required"),
 *   content: z.string().min(10, "Content must be at least 10 characters"),
 *   published: z.boolean().optional().default(false),
 * });
 *
 * // Action for handling form submissions (used with useDynamicSubmitter)
 * export const action = formAction({
 *   schema: formSchema,
 *   handler: async ({ params }, data) => {
 *     const updated = await db.posts.update({
 *       where: { id: params.id },
 *       data,
 *     });
 *     return success({ post: updated });
 *   },
 * });
 * ```
 *
 * @example
 * ### Full CRUD component using both hooks
 *
 * ```tsx
 * import { useDynamicFetcher, useDynamicSubmitter } from "@firtoz/router-toolkit";
 * import { useEffect } from "react";
 *
 * function PostEditor({ postId }: { postId: string }) {
 *   // Fetch post data
 *   const fetcher = useDynamicFetcher<typeof import("./admin.posts.$id")>(
 *     "/admin/posts/:id",
 *     { id: postId }
 *   );
 *
 *   // Submit updates
 *   const submitter = useDynamicSubmitter<typeof import("./admin.posts.$id")>(
 *     "/admin/posts/:id",
 *     { id: postId }
 *   );
 *
 *   useEffect(() => {
 *     fetcher.load();
 *   }, [fetcher.load]);
 *
 *   if (fetcher.state === "loading" && !fetcher.data) {
 *     return <div>Loading...</div>;
 *   }
 *
 *   const post = fetcher.data?.post;
 *
 *   return (
 *     <submitter.Form method="PUT">
 *       <input name="title" defaultValue={post?.title} />
 *       <textarea name="content" defaultValue={post?.content} />
 *       <label>
 *         <input name="published" type="checkbox" defaultChecked={post?.published} />
 *         Published
 *       </label>
 *       <button disabled={submitter.state !== "idle"}>
 *         {submitter.state === "submitting" ? "Saving..." : "Save"}
 *       </button>
 *     </submitter.Form>
 *   );
 * }
 * ```
 */

import { fail, type MaybeError } from "@firtoz/maybe-error";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";

/**
 * Error types that can be returned by formAction
 */
export type FormActionError<TError, TSchema extends z.ZodTypeAny> =
	| {
			type: "validation";
			error: ReturnType<typeof z.treeifyError<z.infer<TSchema>>>;
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
	): Promise<MaybeError<TResult, FormActionError<TError, TSchema>>> => {
		try {
			const rawFormData = await args.request.formData();
			const formData = await zfd.formData(schema).safeParseAsync(rawFormData);

			if (!formData.success) {
				return fail({
					type: "validation" as const,
					error: z.treeifyError<z.infer<TSchema>>(
						formData.error as z.core.$ZodError<z.infer<TSchema>>,
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
