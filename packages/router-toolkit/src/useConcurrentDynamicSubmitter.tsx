/**
 * @fileoverview Concurrent type-safe form submissions for React Router 7
 *
 * Lets you run multiple submissions to the same (or logical) action in parallel,
 * each tracked independently with pending → done state. No single fetcher;
 * each submission is a promise and an entry in `operations`.
 *
 * @example
 * ```tsx
 * const { operations, submitJson } = useConcurrentDynamicSubmitter<typeof import("./api.upload")>("/api/upload");
 *
 * const a = submitJson({ fileId: "1", name: "a.pdf" });
 * const b = submitJson({ fileId: "2", name: "b.pdf" });
 *
 * // FormData: pass serializable submittedData for display (no File/FormData in state)
 * submitFormData(formData, { type: "upload", label: "photo.jpg" });
 * submitFormData(convertFormData, { type: "convert", label: "anim.gif" });
 * // Map operations: op.submittedData for labels, op.data when done
 * {Object.values(operations).map((op) => (
 *   <div key={op.id}>
 *     {op.status === "pending" && <Skeleton>{op.submittedData.label}</Skeleton>}
 *     {op.status === "done" && <Item data={op.data} />}
 *   </div>
 * ))}
 * ```
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { href } from "react-router";
import type { z } from "zod";
import type { HrefArgs } from "./types/HrefArgs";
import type { RegisterPages } from "./types/RegisterPages";

type RouteModule = {
	route: keyof RegisterPages;
	action: (...args: unknown[]) => unknown;
	formSchema: z.ZodType;
};

/** Action result type inferred from the route module's action */
export type ActionResult<TModule extends RouteModule> = Awaited<
	ReturnType<TModule["action"]>
>;

/** Status of a single concurrent submission */
export type OperationStatus = "pending" | "done" | "error";

/** One tracked submission: pending → done (or error). Includes submitted payload for optimistic UI. */
export type Operation<TResponse, TFormData = unknown> = {
	id: string;
	status: OperationStatus;
	/** Data that was sent (for optimistic display while pending, or to show what was submitted) */
	submittedData: TFormData;
	/** Response from the action when status is "done" */
	data?: TResponse;
	error?: unknown;
};

/** Result of submitJson / submitFormData: id to look up in operations, promise to await */
export type SubmitJsonResult<T> = {
	id: string;
	promise: Promise<T>;
};

type SubmitJsonOptions = {
	method?: "POST" | "PUT" | "PATCH" | "DELETE";
};

/** Optional serializable payload for FormData submissions (for display in operations list; FormData/File are not stored in state). */
export type FormDataSubmittedData = Record<string, unknown>;

/** Options for submitFormData (e.g. Accept: application/json so the action returns JSON instead of redirecting). */
export type SubmitFormDataOptions = {
	headers?: HeadersInit;
	method?: "POST" | "PUT" | "PATCH" | "DELETE";
};

/**
 * Submits JSON to the action URL via fetch and returns the parsed JSON.
 */
async function submitJsonToAction<T>(
	actionUrl: string,
	data: unknown,
	options: SubmitJsonOptions & { fetchFn?: typeof fetch },
): Promise<T> {
	const { method = "POST", fetchFn = fetch } = options;
	const res = await fetchFn(actionUrl, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Action failed: ${res.status} ${text}`);
	}
	const json = (await res.json()) as T;
	return json;
}

/**
 * Submits FormData to the action URL. No Content-Type header — browser sets multipart/form-data with boundary.
 * Optional headers (e.g. Accept: application/json) let the action return JSON instead of redirecting.
 */
async function submitFormDataToAction<T>(
	actionUrl: string,
	formData: FormData,
	options: SubmitFormDataOptions & { fetchFn?: typeof fetch },
): Promise<T> {
	const { method = "POST", headers, fetchFn = fetch } = options;
	const res = await fetchFn(actionUrl, {
		method,
		...(headers && { headers }),
		body: formData,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Action failed: ${res.status} ${text}`);
	}
	const json = (await res.json()) as T;
	return json;
}

/**
 * Hook for multiple concurrent submissions to a dynamic route action.
 * Each submission gets an id and appears in `operations` as pending → done (or error).
 * Strongly typed: form data from route's formSchema, result from action return type.
 *
 * @template TInfo - Route module type (e.g. `typeof import("./api.upload")`)
 * @param path - Route path
 * @param args - Route params if path has segments
 * @returns operations map (id → Operation), submitJson, submitFormData (each returns { id, promise })
 */
export function useConcurrentDynamicSubmitter<TInfo extends RouteModule>(
	path: TInfo["route"],
	...args: TInfo["route"] extends "undefined"
		? HrefArgs<"/">
		: HrefArgs<TInfo["route"]>
): {
	operations: Record<
		string,
		Operation<
			ActionResult<TInfo>,
			z.infer<TInfo["formSchema"]> | FormDataSubmittedData
		>
	>;
	submitJson: (
		data: z.infer<TInfo["formSchema"]>,
		options?: SubmitJsonOptions,
	) => SubmitJsonResult<ActionResult<TInfo>>;
	submitFormData: (
		formData: FormData,
		submittedData?: FormDataSubmittedData,
		options?: SubmitFormDataOptions,
	) => SubmitJsonResult<ActionResult<TInfo>>;
} {
	const actionUrl = useMemo(() => {
		// biome-ignore lint/suspicious/noExplicitAny: Intentional
		return href(path, ...(args as any));
	}, [path, args]);

	type JsonFormData = z.infer<TInfo["formSchema"]>;
	type Op = Operation<
		ActionResult<TInfo>,
		JsonFormData | FormDataSubmittedData
	>;

	const nextIdRef = useRef(0);
	const [operations, setOperations] = useState<Record<string, Op>>({});

	const submitJson = useCallback(
		(
			data: JsonFormData,
			options: SubmitJsonOptions = {},
		): SubmitJsonResult<ActionResult<TInfo>> => {
			const id = `op-${++nextIdRef.current}`;
			setOperations((prev) => ({
				...prev,
				[id]: { id, status: "pending", submittedData: data },
			}));

			const promise = submitJsonToAction<ActionResult<TInfo>>(
				actionUrl,
				data,
				options,
			)
				.then((responseData) => {
					setOperations((prev) => ({
						...prev,
						[id]: {
							id,
							status: "done",
							submittedData: data,
							data: responseData,
						},
					}));
					return responseData;
				})
				.catch((error) => {
					setOperations((prev) => ({
						...prev,
						[id]: {
							id,
							status: "error",
							submittedData: data,
							error,
						},
					}));
					throw error;
				});

			return { id, promise };
		},
		[actionUrl],
	);

	const submitFormData = useCallback(
		(
			formData: FormData,
			submittedData: FormDataSubmittedData = {},
			options: SubmitFormDataOptions = {},
		): SubmitJsonResult<ActionResult<TInfo>> => {
			const id = `op-${++nextIdRef.current}`;
			setOperations((prev) => ({
				...prev,
				[id]: { id, status: "pending", submittedData },
			}));

			const promise = submitFormDataToAction<ActionResult<TInfo>>(
				actionUrl,
				formData,
				options,
			)
				.then((responseData) => {
					setOperations((prev) => ({
						...prev,
						[id]: {
							id,
							status: "done",
							submittedData,
							data: responseData,
						},
					}));
					return responseData;
				})
				.catch((error) => {
					setOperations((prev) => ({
						...prev,
						[id]: {
							id,
							status: "error",
							submittedData,
							error,
						},
					}));
					throw error;
				});

			return { id, promise };
		},
		[actionUrl],
	);

	return { operations, submitJson, submitFormData };
}
