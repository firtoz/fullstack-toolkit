/**
 * @fileoverview Global provider for concurrent form submissions via React Router fetchers.
 *
 * Mounts components that use useFetcher with unique keys so each submission goes through
 * the framework (correct .data URL and turbo-stream decoding). Path/args are per submission.
 *
 * @example
 * ```tsx
 * // Root:
 * <ConcurrentSubmitterProvider>
 *   <Outlet />
 * </ConcurrentSubmitterProvider>
 *
 * // Anywhere: use useConcurrentSubmitter() from "./useConcurrentSubmitter"
 * ```
 */

import React, {
	useCallback,
	useMemo,
	useRef,
	useState,
	createContext,
} from "react";
import { href, useFetcher } from "react-router";
import type { SubmitTarget } from "react-router";

/** Status of a single concurrent submission */
export type OperationStatus = "pending" | "done" | "error";

/** One tracked submission: pending → done (or error). Includes submitted payload for optimistic UI. */
export type Operation<TResponse = unknown, TFormData = unknown> = {
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

/** Optional serializable payload for FormData submissions (for display in operations list). */
export type FormDataSubmittedData = Record<string, unknown>;

export type SubmitJsonOptions = {
	method?: "POST" | "PUT" | "PATCH" | "DELETE";
};

export type SubmitFormDataOptions = {
	headers?: HeadersInit;
	method?: "POST" | "PUT" | "PATCH" | "DELETE";
};

type PendingJson = {
	kind: "json";
	actionUrl: string;
	method: string;
	encType: "application/json";
	data: unknown;
};

type PendingForm = {
	kind: "form";
	actionUrl: string;
	method: string;
	encType: "multipart/form-data";
	formData: FormData;
};

type PendingSubmit = PendingJson | PendingForm;

type OperationState = Operation<unknown, unknown> & {
	resolve: (value: unknown) => void;
	reject: (error: unknown) => void;
	pendingSubmit?: PendingSubmit;
};

function buildActionUrl(path: string, args?: Record<string, string>): string {
	// biome-ignore lint/suspicious/noExplicitAny: path is dynamic from caller
	return args ? href(path as any, args as any) : (href(path as any) as string);
}

type ContextValue = {
	operations: Record<string, Operation<unknown, unknown>>;
	addJsonSubmission: (
		path: string,
		args: Record<string, string> | undefined,
		data: unknown,
		options?: SubmitJsonOptions,
	) => SubmitJsonResult<unknown>;
	addFormSubmission: (
		path: string,
		args: Record<string, string> | undefined,
		formData: FormData,
		submittedData: FormDataSubmittedData,
		options?: SubmitFormDataOptions,
	) => SubmitJsonResult<unknown>;
	onSettle: (id: string, data?: unknown, error?: unknown) => void;
};

export const ConcurrentSubmitterContext = createContext<ContextValue | null>(
	null,
);

function FetcherRunner({
	id,
	pendingSubmit,
	onSettle,
}: {
	id: string;
	pendingSubmit: PendingSubmit;
	onSettle: (id: string, data?: unknown, error?: unknown) => void;
}) {
	const fetcher = useFetcher({ key: id });
	const submittedRef = useRef(false);
	const settledRef = useRef(false);
	const prevStateRef = useRef(fetcher.state);

	React.useEffect(() => {
		if (!pendingSubmit || submittedRef.current) return;
		submittedRef.current = true;

		if (pendingSubmit.kind === "json") {
			fetcher.submit(pendingSubmit.data as SubmitTarget, {
				action: pendingSubmit.actionUrl,
				method: pendingSubmit.method as "POST" | "PUT" | "PATCH" | "DELETE",
				encType: "application/json",
			});
		} else {
			fetcher.submit(pendingSubmit.formData, {
				action: pendingSubmit.actionUrl,
				method: pendingSubmit.method as "POST" | "PUT" | "PATCH" | "DELETE",
				encType: "multipart/form-data",
			});
		}
	}, [pendingSubmit, fetcher.submit]);

	React.useEffect(() => {
		const wasSubmitting = prevStateRef.current === "submitting";
		prevStateRef.current = fetcher.state;

		if (wasSubmitting && fetcher.state === "idle" && !settledRef.current) {
			settledRef.current = true;
			if (fetcher.data !== undefined) {
				onSettle(id, fetcher.data, undefined);
			} else {
				const err =
					(fetcher as { error?: unknown }).error ??
					new Error("Submission failed");
				onSettle(id, undefined, err);
			}
		}
	}, [id, fetcher.state, fetcher.data, onSettle]);

	return null;
}

export function ConcurrentSubmitterProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const nextIdRef = useRef(0);
	const [operationsState, setOperationsState] = useState<
		Record<string, OperationState>
	>({});

	const onSettle = useCallback(
		(id: string, data?: unknown, error?: unknown) => {
			setOperationsState((prev) => {
				const op = prev[id];
				if (!op) return prev;
				const { resolve, reject, ...rest } = op;
				if (error !== undefined) {
					reject(error);
					return {
						...prev,
						[id]: {
							...rest,
							status: "error" as OperationStatus,
							error,
							resolve,
							reject,
							pendingSubmit: undefined,
						},
					};
				}
				resolve(data);
				return {
					...prev,
					[id]: {
						...rest,
						status: "done" as OperationStatus,
						data,
						resolve,
						reject,
						pendingSubmit: undefined,
					},
				};
			});
		},
		[],
	);

	const addJsonSubmission = useCallback(
		(
			path: string,
			args: Record<string, string> | undefined,
			data: unknown,
			options: SubmitJsonOptions = {},
		): SubmitJsonResult<unknown> => {
			const id = `op-${++nextIdRef.current}`;
			const method = options.method ?? "POST";
			const actionUrl = buildActionUrl(path, args);

			let resolve!: (value: unknown) => void;
			let reject!: (error: unknown) => void;
			const promise = new Promise<unknown>((res, rej) => {
				resolve = res;
				reject = rej;
			});

			const pendingSubmit: PendingJson = {
				kind: "json",
				actionUrl,
				method,
				encType: "application/json",
				data,
			};

			const op: OperationState = {
				id,
				status: "pending",
				submittedData: data as Record<string, unknown>,
				resolve,
				reject,
				pendingSubmit,
			};

			setOperationsState((prev) => ({ ...prev, [id]: op }));
			return { id, promise };
		},
		[],
	);

	const addFormSubmission = useCallback(
		(
			path: string,
			args: Record<string, string> | undefined,
			formData: FormData,
			submittedData: FormDataSubmittedData,
			options: SubmitFormDataOptions = {},
		): SubmitJsonResult<unknown> => {
			const id = `op-${++nextIdRef.current}`;
			const method = options.method ?? "POST";
			const actionUrl = buildActionUrl(path, args);

			let resolve!: (value: unknown) => void;
			let reject!: (error: unknown) => void;
			const promise = new Promise<unknown>((res, rej) => {
				resolve = res;
				reject = rej;
			});

			const pendingSubmit: PendingForm = {
				kind: "form",
				actionUrl,
				method,
				encType: "multipart/form-data",
				formData,
			};

			const op: OperationState = {
				id,
				status: "pending",
				submittedData,
				resolve,
				reject,
				pendingSubmit,
			};

			setOperationsState((prev) => ({ ...prev, [id]: op }));
			return { id, promise };
		},
		[],
	);

	const operations = useMemo(() => {
		const result: Record<string, Operation<unknown, unknown>> = {};
		for (const [k, v] of Object.entries(operationsState)) {
			const { resolve: _r, reject: _j, pendingSubmit: _p, ...rest } = v;
			result[k] = rest;
		}
		return result;
	}, [operationsState]);

	const value = useMemo<ContextValue>(
		() => ({
			operations,
			addJsonSubmission,
			addFormSubmission,
			onSettle,
		}),
		[operations, addJsonSubmission, addFormSubmission, onSettle],
	);

	return (
		<ConcurrentSubmitterContext.Provider value={value}>
			{children}
			{Object.entries(operationsState).map(
				([id, op]) =>
					op.pendingSubmit && (
						<FetcherRunner
							key={id}
							id={id}
							pendingSubmit={op.pendingSubmit}
							onSettle={onSettle}
						/>
					),
			)}
		</ConcurrentSubmitterContext.Provider>
	);
}
