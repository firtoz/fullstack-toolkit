/**
 * @fileoverview Type-safe dynamic form submission hook for React Router 7
 *
 * This module provides a hook that creates a type-safe fetcher for submitting forms
 * to dynamic routes with full TypeScript inference for the form schema and route params.
 *
 * @example
 * ### Route Setup (`app/routes/admin.posts.$id.tsx`)
 *
 * First, set up your route with the required exports:
 *
 * ```typescript
 * import { z } from "zod";
 * import { formAction, type RoutePath } from "@firtoz/router-toolkit";
 * import { success, fail } from "@firtoz/maybe-error";
 *
 * // Export the route path for type inference
 * export const route: RoutePath<"/admin/posts/:id"> = "/admin/posts/:id";
 *
 * // Define the form schema
 * export const formSchema = z.object({
 *   title: z.string().min(1, "Title is required"),
 *   content: z.string().min(10, "Content must be at least 10 characters"),
 *   published: z.boolean().optional().default(false),
 * });
 *
 * // Create the action using formAction
 * export const action = formAction({
 *   schema: formSchema,
 *   handler: async ({ request, params }, formData) => {
 *     const postId = params.id;
 *     const updated = await db.posts.update({
 *       where: { id: postId },
 *       data: formData,
 *     });
 *     return success(updated);
 *   },
 * });
 * ```
 *
 * @example
 * ### Using the hook in a component
 *
 * ```tsx
 * import { useDynamicSubmitter } from "@firtoz/router-toolkit";
 *
 * function EditPostForm({ postId }: { postId: string }) {
 *   // Type-safe submitter with full inference
 *   const submitter = useDynamicSubmitter<typeof import("./admin.posts.$id")>(
 *     "/admin/posts/:id",
 *     { id: postId }
 *   );
 *
 *   // submitter.data is the typed response from the action
 *   // submitter.state is "idle" | "loading" | "submitting"
 *
 *   // Option 1: Submit as JSON (recommended for programmatic submissions)
 *   // Defaults to POST if no options provided
 *   const handleSubmitJson = async () => {
 *     await submitter.submitJson({
 *       title: "My Post",
 *       content: "Post content here",
 *       published: true,
 *     });
 *   };
 *
 *   // Option 2: Submit with FormData or SubmitTarget
 *   const handleSubmit = async (formData: FormData) => {
 *     await submitter.submit(formData, { method: "POST" });
 *   };
 *
 *   // Option 3: Use the Form component (defaults to POST)
 *   return (
 *     <submitter.Form>
 *       <input name="title" />
 *       <textarea name="content" />
 *       <button type="submit">Save</button>
 *     </submitter.Form>
 *   );
 * }
 * ```
 *
 * @example
 * ### Handling responses
 *
 * ```tsx
 * function LoginForm() {
 *   const submitter = useDynamicSubmitter<typeof import("./auth.login")>("/auth/login");
 *
 *   useEffect(() => {
 *     if (submitter.data?.success) {
 *       // Handle success
 *       console.log("Logged in as:", submitter.data.value.user.email);
 *     } else if (submitter.data && !submitter.data.success) {
 *       // Handle error
 *       if (submitter.data.error.type === "validation") {
 *         console.log("Validation errors:", submitter.data.error.error);
 *       }
 *     }
 *   }, [submitter.data]);
 *
 *   return (
 *     <submitter.Form>
 *       <input name="email" type="email" />
 *       <input name="password" type="password" />
 *       <button disabled={submitter.state !== "idle"}>
 *         {submitter.state === "submitting" ? "Logging in..." : "Login"}
 *       </button>
 *     </submitter.Form>
 *   );
 * }
 * ```
 */

// biome-ignore lint/style/useImportType: We need to import React here.
import React, { useCallback, useMemo } from "react";
import {
	type FetcherFormProps,
	href,
	type SubmitOptions,
	type SubmitTarget,
	useFetcher,
} from "react-router";
import type { z } from "zod";
import type { Func } from "./types/Func";
import type { HrefArgs } from "./types/HrefArgs";
import type { RegisterPages } from "./types/RegisterPages";

/**
 * Represents a route module with the required exports for useDynamicSubmitter.
 *
 * A valid route module must export:
 * - `route`: The route path (e.g., "/admin/posts/:id")
 * - `action`: The form action handler created with `formAction`
 * - `formSchema`: The Zod schema for form validation
 */
type RouteModule = {
	route: keyof RegisterPages;
	action: Func;
	formSchema: z.ZodType;
};

/**
 * Function type for submitting form data with a SubmitTarget.
 *
 * Accepts the form schema data combined with SubmitTarget (FormData, HTMLFormElement, etc.)
 * Use this when you have a FormData object or form element reference.
 *
 * @example
 * ```typescript
 * // With FormData
 * submitter.submit(formData, { method: "POST" });
 *
 * // With form element reference
 * submitter.submit(formRef.current, { method: "POST" });
 * ```
 */
type SubmitFunc<TModule extends RouteModule> = (
	target: z.infer<TModule["formSchema"]> & SubmitTarget,
	options: Omit<SubmitOptions, "action" | "method" | "encType"> & {
		method: Exclude<SubmitOptions["method"], "GET">;
	},
) => Promise<void>;

/**
 * Options for submitJson function.
 * Method defaults to "POST" if not specified.
 */
type SubmitJsonOptions = Omit<
	SubmitOptions,
	"action" | "method" | "encType"
> & {
	method?: Exclude<SubmitOptions["method"], "GET">;
};

/**
 * Function type for submitting form data as JSON.
 *
 * Accepts only the inferred form schema type (plain object).
 * Automatically serializes the data as JSON. This is the recommended
 * approach for programmatic form submissions.
 *
 * Options are optional and default to `{ method: "POST" }`.
 *
 * @example
 * ```typescript
 * // Submit a plain object - fully type-safe (defaults to POST)
 * await submitter.submitJson({
 *   email: "user@example.com",
 *   password: "secret123",
 *   rememberMe: true,
 * });
 *
 * // Or specify a different method
 * await submitter.submitJson(data, { method: "PUT" });
 * ```
 */
type SubmitJsonFunc<TModule extends RouteModule> = (
	data: z.infer<TModule["formSchema"]>,
	options?: SubmitJsonOptions,
) => Promise<void>;

/**
 * Form component type with pre-bound action URL.
 *
 * Renders a form element that automatically submits to the correct route.
 * Method defaults to "POST" if not specified.
 *
 * @example
 * ```typescript
 * // Defaults to POST
 * <submitter.Form>
 *   <input name="title" />
 *   <button type="submit">Submit</button>
 * </submitter.Form>
 *
 * // Or specify a different method
 * <submitter.Form method="PUT">
 *   ...
 * </submitter.Form>
 * ```
 */
type SubmitForm = (
	props: Omit<
		FetcherFormProps & React.RefAttributes<HTMLFormElement>,
		"action" | "method"
	> & {
		method?: Exclude<SubmitOptions["method"], "GET">;
	},
) => React.ReactElement;

/**
 * Creates a type-safe fetcher for submitting forms to dynamic routes.
 *
 * This hook provides full TypeScript inference for:
 * - Route parameters (from the route path)
 * - Form data schema (from the route's formSchema export)
 * - Action response type (from the route's action export)
 *
 * @template TInfo - The route module type (use `typeof import("./route-file")`)
 *
 * @param path - The route path (must match the route's `route` export)
 * @param args - Route parameters (if the route has dynamic segments like `:id`)
 *
 * @returns An extended fetcher object with:
 * - `submit` - Submit with FormData/SubmitTarget (includes schema type)
 * - `submitJson` - Submit a plain object as JSON (schema type only)
 * - `Form` - Pre-bound form component
 * - `data` - Response data from the action (typed)
 * - `state` - Fetcher state ("idle" | "loading" | "submitting")
 * - All other useFetcher properties
 *
 * @example
 * ### Basic usage with route parameters
 *
 * ```typescript
 * // In your route file (app/routes/users.$userId.settings.tsx):
 * export const route: RoutePath<"/users/:userId/settings"> = "/users/:userId/settings";
 * export const formSchema = z.object({
 *   displayName: z.string().min(2),
 *   email: z.string().email(),
 *   notifications: z.boolean().default(true),
 * });
 * export const action = formAction({ schema: formSchema, handler: ... });
 *
 * // In your component:
 * const submitter = useDynamicSubmitter<typeof import("./users.$userId.settings")>(
 *   "/users/:userId/settings",
 *   { userId: "123" }
 * );
 *
 * // Submit using submitJson (type-safe, no FormData needed, defaults to POST)
 * await submitter.submitJson({
 *   displayName: "John Doe",
 *   email: "john@example.com",
 *   notifications: true,
 * });
 *
 * // Check the response
 * if (submitter.data?.success) {
 *   console.log("Settings updated!");
 * }
 * ```
 */
export const useDynamicSubmitter = <TInfo extends RouteModule>(
	path: TInfo["route"],
	...args: TInfo["route"] extends "undefined"
		? HrefArgs<"/">
		: HrefArgs<TInfo["route"]>
): Omit<
	ReturnType<typeof useFetcher<TInfo["action"]>>,
	"load" | "submit" | "Form"
> & {
	/** Submit with FormData or SubmitTarget (schema type & SubmitTarget) */
	submit: SubmitFunc<TInfo>;
	/** Submit a plain object as JSON (schema type only, defaults to POST) */
	submitJson: SubmitJsonFunc<TInfo>;
	/** Pre-bound Form component with action URL already set (defaults to POST) */
	Form: SubmitForm;
} => {
	const url = useMemo(() => {
		// biome-ignore lint/suspicious/noExplicitAny: Intentional
		return href(path, ...(args as any));
	}, [path, args]);

	const fetcher = useFetcher<TInfo["action"]>({
		key: `submitter-${url}`,
	});

	const submit: SubmitFunc<TInfo> = useCallback(
		(target, options) => {
			return fetcher.submit(target, {
				...options,
				action: url,
				encType: "multipart/form-data",
			});
		},
		[fetcher.submit, url],
	);

	const submitJson: SubmitJsonFunc<TInfo> = useCallback(
		(data, options = {}) => {
			return fetcher.submit(data as SubmitTarget, {
				...options,
				method: options.method ?? "POST",
				action: url,
				encType: "application/json",
			});
		},
		[fetcher.submit, url],
	);

	const OriginalForm = fetcher.Form;

	const Form: SubmitForm = useCallback(
		({ method = "POST", ...props }) => {
			return <OriginalForm action={url} method={method} {...props} />;
		},
		[url, OriginalForm],
	);

	return {
		...fetcher,
		submit,
		submitJson,
		Form,
	};
};
