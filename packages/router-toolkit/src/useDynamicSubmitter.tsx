/**
 * @fileoverview Type-safe dynamic form submission hook for React Router 7
 *
 * This module provides a hook that creates a type-safe fetcher for submitting forms
 * to dynamic routes with full TypeScript inference for the form schema and route params.
 *
 * **Awaiting results:** `submit` and `submitJson` return a `Promise` that resolves with the
 * action payload after the submission completes (fetcher leaves `submitting` / `loading` for
 * `idle`). The hook does **not** expose `data` or `state`—use the promise result (and local
 * React state) for outcomes and loading UX. For declarative UI tied to the same fetcher, use
 * {@link useDynamicSubmitterFetcher} (or {@link dynamicSubmitterFetcherKey} with `useFetcher`).
 * Use **one awaited submit at
 * a time** per hook instance; React Router’s
 * single fetcher replaces an in-flight request when you submit again. If you call `submit` or
 * `submitJson` again before the previous promise settles, the previous promise is **rejected**
 * with {@link SubmitterSupersededError}. That applies **per React Router fetcher key** (same
 * resolved URL and {@link UseDynamicSubmitterOptions.keySuffix}): two hook instances that share
 * the same key also supersede one another’s in-flight promise. Use distinct `keySuffix` values
 * when you need independent overlapping submissions to the same route. For many overlapping
 * operations, use `ConcurrentSubmitterProvider` / `useConcurrentSubmitter` instead.
 *
 * **Unmount:** If the component unmounts while a returned promise is still pending, that
 * promise is **rejected** with {@link SubmitterUnmountedError}.
 *
 * **Local `useState` vs {@link useDynamicSubmitterFetcher}:** For programmatic
 * `await submitter.submitJson`, a local pending flag and `try` / `finally` is often enough for
 * disabled buttons and matches the promise-first API. Use {@link useDynamicSubmitterFetcher} when
 * you want declarative `fetcher.state` / `fetcher.data` in JSX (especially with `submitter.Form`
 * or inline errors). The package README documents trade-offs in more detail.
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
 *   const [pending, setPending] = useState(false);
 *
 *   // Option 1: Submit as JSON (recommended for programmatic submissions)
 *   // Defaults to POST if no options provided
 *   const handleSubmitJson = async () => {
 *     setPending(true);
 *     try {
 *       const data = await submitter.submitJson({
 *         title: "My Post",
 *         content: "Post content here",
 *         published: true,
 *       });
 *       if (data.success) {
 *         console.log("Saved");
 *       }
 *     } finally {
 *       setPending(false);
 *     }
 *   };
 *
 *   // Option 2: Submit with FormData or SubmitTarget
 *   const handleSubmit = async (formData: FormData) => {
 *     await submitter.submit(formData, { method: "POST" });
 *   };
 *
 *   // Option 3: Use the Form component (defaults to POST); pair with useDynamicSubmitterFetcher(submitter) if you need reactive state
 *   return (
 *     <submitter.Form>
 *       <input name="title" />
 *       <textarea name="content" />
 *       <button type="submit" disabled={pending}>Save</button>
 *     </submitter.Form>
 *   );
 * }
 * ```
 */

// biome-ignore lint/style/useImportType: We need to import React here.
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
	type FetcherFormProps,
	type HTMLFormMethod,
	href,
	type SubmitOptions,
	type SubmitTarget,
	useFetcher,
} from "react-router";
import type { z } from "zod";
import type { HrefArgs } from "./types/HrefArgs";
import type { RouteWithActionModule } from "./types/RouteWithActionModule";

/**
 * Thrown when a new `submit` or `submitJson` runs before a prior returned promise has settled.
 * The new submission proceeds; catch this error if overlapping calls are expected.
 */
export class SubmitterSupersededError extends Error {
	override readonly name = "SubmitterSupersededError";
	constructor(
		message = "This submission was superseded by a newer submit before it completed.",
	) {
		super(message);
	}
}

/**
 * Thrown when the component that owns the submitter unmounts before a `submit` /
 * `submitJson` promise has settled.
 */
export class SubmitterUnmountedError extends Error {
	override readonly name = "SubmitterUnmountedError";
	constructor(
		message = "The submitter was unmounted before this submission completed.",
	) {
		super(message);
	}
}

/**
 * Action payload type on the fetcher (same shape React Router puts on `fetcher.data` after the action runs).
 * Includes `undefined` while idle or in flight—use {@link SubmitterSettledData} for the value after
 * `await submitter.submit` / `await submitter.submitJson`.
 */
export type DynamicSubmitterData<TInfo extends RouteWithActionModule> =
	ReturnType<typeof useFetcher<TInfo["action"]>>["data"];

/**
 * Payload type after a successful `await submitter.submit` / `await submitter.submitJson`.
 * Omits `undefined` from {@link DynamicSubmitterData}: the promise only resolves when `fetcher.data`
 * is defined (otherwise it rejects). Inner success values may still be void / optional `result` for
 * `MaybeError<undefined>` from `formAction` + `success()`.
 */
export type SubmitterSettledData<TInfo extends RouteWithActionModule> =
	NonNullable<DynamicSubmitterData<TInfo>>;

/**
 * Options for {@link useDynamicSubmitter}.
 */
export type UseDynamicSubmitterOptions = {
	/**
	 * Appended to the default fetcher key so multiple submitters can target the same resolved URL
	 * without sharing React Router fetcher state. Omit to use the default key for that URL.
	 */
	keySuffix?: string;
};

/**
 * React Router `useFetcher` key used by {@link useDynamicSubmitter} for a resolved href.
 * Pass the same string as {@link UseDynamicSubmitterResult.fetcherKey} (or call with the same
 * `resolvedHref` and `keySuffix` as the submitter) so a parallel `useFetcher({ key })` observes
 * the same submission lifecycle.
 *
 * When `keySuffix` is set, it is encoded and joined with a fixed delimiter so arbitrary strings
 * are safe in the key.
 */
export function dynamicSubmitterFetcherKey(
	resolvedHref: string,
	keySuffix?: string,
): string {
	const base = `submitter-${resolvedHref}`;
	if (keySuffix === undefined || keySuffix === "") {
		return base;
	}
	return `${base}::${encodeURIComponent(keySuffix)}`;
}

function isSubmitterOptions(x: unknown): x is UseDynamicSubmitterOptions {
	if (x === null || typeof x !== "object") return false;
	const keys = Object.keys(x as object);
	if (keys.length === 0) return false;
	return keys.every((k) => k === "keySuffix");
}

function parseUseDynamicSubmitterRestArgs(args: readonly unknown[]): {
	hrefArgs: unknown[];
	options: UseDynamicSubmitterOptions;
} {
	if (args.length === 0) {
		return { hrefArgs: [], options: {} };
	}
	const last = args[args.length - 1];
	if (args.length >= 2 && isSubmitterOptions(last)) {
		return { hrefArgs: [...args.slice(0, -1)], options: last };
	}
	if (args.length === 1 && isSubmitterOptions(args[0])) {
		return { hrefArgs: [], options: args[0] };
	}
	return { hrefArgs: [...args], options: {} };
}

type UseDynamicSubmitterRest<R extends RouteWithActionModule["route"]> =
	HrefArgs<R> extends readonly []
		? [options?: UseDynamicSubmitterOptions]
		: [...hrefArgs: HrefArgs<R>, options?: UseDynamicSubmitterOptions];

type PendingAwait = {
	gen: number;
	ownerId: number;
	reject: (reason: unknown) => void;
	/** Called when the shared fetcher reaches `idle` for this submission generation. */
	finishIdle: (data: unknown, error: unknown | undefined) => void;
};

type SubmitterKeyBucket = {
	submitGen: number;
	pending: PendingAwait | null;
};

const submitterKeyBuckets = new Map<string, SubmitterKeyBucket>();

function getSubmitterKeyBucket(key: string): SubmitterKeyBucket {
	let b = submitterKeyBuckets.get(key);
	if (!b) {
		b = { submitGen: 0, pending: null };
		submitterKeyBuckets.set(key, b);
	}
	return b;
}

let nextSubmitterOwnerId = 1;
function allocateSubmitterOwnerId(): number {
	return nextSubmitterOwnerId++;
}

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
type SubmitFunc<TModule extends RouteWithActionModule> = (
	target: z.infer<TModule["formSchema"]> & SubmitTarget,
	options: Omit<SubmitOptions, "action" | "method" | "encType"> & {
		method: Exclude<SubmitOptions["method"], "GET">;
	},
) => Promise<SubmitterSettledData<TModule>>;

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
type SubmitJsonFunc<TModule extends RouteWithActionModule> = (
	data: z.infer<TModule["formSchema"]>,
	options?: SubmitJsonOptions,
) => Promise<SubmitterSettledData<TModule>>;

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
 * Stable object returned by {@link useDynamicSubmitter}: `submit`, `submitJson`, `Form`, and
 * `fetcherKey`. The reference is memoized and does not change when the internal fetcher’s
 * `state` / `data` update.
 */
export type UseDynamicSubmitterResult<TInfo extends RouteWithActionModule> = {
	submit: SubmitFunc<TInfo>;
	submitJson: SubmitJsonFunc<TInfo>;
	Form: SubmitForm;
	/** Pass to {@link useDynamicSubmitterFetcher} or `useFetcher({ key })` for reactive `state` / `data`. */
	fetcherKey: string;
};

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
 * @param rest - Route parameters (if any), then optional {@link UseDynamicSubmitterOptions}. For
 * static routes, you may pass only options as the second argument (e.g. `{ keySuffix: "a" }`).
 * Options are recognized only when the object contains exclusively the `keySuffix` key (do not use
 * a route param object whose only field is named `keySuffix` unless it is meant as options).
 *
 * @returns Stable `{ submit, submitJson, Form, fetcherKey }`. Await the promises for action results;
 * use {@link useDynamicSubmitterFetcher} or local state for reactive loading/data.
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
 * const data = await submitter.submitJson({
 *   displayName: "John Doe",
 *   email: "john@example.com",
 *   notifications: true,
 * });
 *
 * if (data.success) {
 *   console.log("Settings updated!");
 * }
 * ```
 */
export function useDynamicSubmitter<TInfo extends RouteWithActionModule>(
	path: TInfo["route"],
	...rest: UseDynamicSubmitterRest<TInfo["route"]>
): UseDynamicSubmitterResult<TInfo> {
	const { hrefArgs, options } = parseUseDynamicSubmitterRestArgs(rest);
	const keySuffix = options.keySuffix;

	// biome-ignore lint/correctness/useExhaustiveDependencies: hrefArgs spread tracks dynamic route params
	const url = useMemo(() => {
		// biome-ignore lint/suspicious/noExplicitAny: Intentional
		return href(path, ...(hrefArgs as any));
	}, [path, keySuffix, ...(hrefArgs as unknown[])]);

	const fetcherKey = useMemo(
		() => dynamicSubmitterFetcherKey(url, keySuffix),
		[url, keySuffix],
	);

	const fetcher = useFetcher<TInfo["action"]>({
		key: fetcherKey,
	});

	const fetcherRef = useRef(fetcher);
	fetcherRef.current = fetcher;

	const ownerIdRef = useRef(allocateSubmitterOwnerId());
	const prevStateRef = useRef(fetcher.state);

	const beginSubmit = useCallback(
		(runSubmit: () => void) => {
			return new Promise<SubmitterSettledData<TInfo>>((resolve, reject) => {
				const bucket = getSubmitterKeyBucket(fetcherKey);
				const prevPending = bucket.pending;
				if (prevPending) {
					prevPending.reject(new SubmitterSupersededError());
				}
				bucket.submitGen += 1;
				const gen = bucket.submitGen;
				bucket.pending = {
					gen,
					ownerId: ownerIdRef.current,
					reject,
					finishIdle: (data, error) => {
						if (data !== undefined) {
							resolve(data as SubmitterSettledData<TInfo>);
						} else {
							reject(error ?? new Error("Submission failed"));
						}
					},
				};
				runSubmit();
			});
		},
		[fetcherKey],
	);

	useEffect(() => {
		return () => {
			const bucket = getSubmitterKeyBucket(fetcherKey);
			const pending = bucket.pending;
			if (pending && pending.ownerId === ownerIdRef.current) {
				bucket.pending = null;
				pending.reject(new SubmitterUnmountedError());
			}
		};
	}, [fetcherKey]);

	useEffect(() => {
		const prev = prevStateRef.current;
		prevStateRef.current = fetcher.state;
		const wasWorking = prev === "submitting" || prev === "loading";
		if (!wasWorking || fetcher.state !== "idle") {
			return;
		}
		const bucket = getSubmitterKeyBucket(fetcherKey);
		const p = bucket.pending;
		if (!p || p.gen !== bucket.submitGen) {
			return;
		}
		bucket.pending = null;
		p.finishIdle(fetcher.data, undefined);
	}, [fetcherKey, fetcher.state, fetcher.data]);

	const submit: SubmitFunc<TInfo> = useCallback(
		(target, options) => {
			return beginSubmit(() => {
				const f = fetcherRef.current;
				void f.submit(target, {
					...options,
					method: (options?.method ?? "POST") as HTMLFormMethod,
					action: url,
					encType: "multipart/form-data",
				} as Parameters<typeof f.submit>[1]);
			});
		},
		[beginSubmit, url],
	);

	const submitJson: SubmitJsonFunc<TInfo> = useCallback(
		(data, options = {}) => {
			return beginSubmit(() => {
				const f = fetcherRef.current;
				void f.submit(
					data as SubmitTarget,
					{
						...options,
						method: (options.method ?? "POST") as HTMLFormMethod,
						action: url,
						encType: "application/json",
					} as Parameters<typeof f.submit>[1],
				);
			});
		},
		[beginSubmit, url],
	);

	const fetcherFormRef = useRef(fetcher.Form);
	fetcherFormRef.current = fetcher.Form;

	const Form: SubmitForm = useCallback(
		({ method = "POST", ...props }) => {
			const OriginalForm = fetcherFormRef.current;
			return <OriginalForm action={url} method={method} {...props} />;
		},
		[url],
	);

	return useMemo(
		() => ({
			submit,
			submitJson,
			Form,
			fetcherKey,
		}),
		[submit, submitJson, Form, fetcherKey],
	);
}

/**
 * React Router `useFetcher` bound to the same key as {@link useDynamicSubmitter}, so `state` /
 * `data` reflect the same submissions as `submitter.submit` / `submitter.Form`.
 *
 * Call at component top level next to `useDynamicSubmitter`.
 */
export function useDynamicSubmitterFetcher<TInfo extends RouteWithActionModule>(
	submitter: UseDynamicSubmitterResult<TInfo>,
) {
	return useFetcher<TInfo["action"]>({ key: submitter.fetcherKey });
}
