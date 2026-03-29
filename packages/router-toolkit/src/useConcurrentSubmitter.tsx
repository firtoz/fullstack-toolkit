/**
 * @fileoverview Typed hook for concurrent form submissions. Use within ConcurrentSubmitterProvider.
 */

import { useCallback, useContext } from "react";
import type { z } from "zod";
import type { RegisterPages } from "./types/RegisterPages";
import type {
	ActionResult,
	RouteWithActionModule,
} from "./types/RouteWithActionModule";
import { ConcurrentSubmitterContext } from "./ConcurrentSubmitterProvider";
import type {
	FormDataSubmittedData,
	Operation,
	SubmitFormDataOptions,
	SubmitJsonOptions,
	SubmitJsonResult,
} from "./ConcurrentSubmitterProvider";

export type { ActionResult };

type RouteParams<R extends keyof RegisterPages> = RegisterPages[R]["params"];

/**
 * True when the route has no dynamic segments (`params: {}` from React Router typegen).
 * Uses `keyof … extends never` so real empty params stay distinct from the `RegisterPages`
 * fallback (`AnyPages` → `params: Record<string, …>` has `keyof` = `string`, not `never`).
 * That avoids mis-resolving `submitJson(path, data)` as the route-args overload (strings only).
 */
type HasNoParams<R extends keyof RegisterPages> = [
	keyof RegisterPages[R]["params"],
] extends [never]
	? true
	: false;

type HasOptionalParams<R extends keyof RegisterPages> =
	HasNoParams<R> extends true
		? false
		: Partial<RouteParams<R>> extends RouteParams<R>
			? true
			: false;

// Args immediately after path (when needed), matching useDynamicFetcher/useDynamicSubmitter.
// Order: (path, args?, data, options?) and (path, args?, formData, submittedData?, options?).
type SubmitJsonFn<TInfo extends RouteWithActionModule> =
	HasNoParams<TInfo["route"]> extends true
		? (
				path: TInfo["route"],
				data: z.infer<TInfo["formSchema"]>,
				options?: SubmitJsonOptions,
			) => SubmitJsonResult<ActionResult<TInfo>>
		: HasOptionalParams<TInfo["route"]> extends true
			? (
					path: TInfo["route"],
					args: RouteParams<TInfo["route"]> | undefined,
					data: z.infer<TInfo["formSchema"]>,
					options?: SubmitJsonOptions,
				) => SubmitJsonResult<ActionResult<TInfo>>
			: (
					path: TInfo["route"],
					args: RouteParams<TInfo["route"]>,
					data: z.infer<TInfo["formSchema"]>,
					options?: SubmitJsonOptions,
				) => SubmitJsonResult<ActionResult<TInfo>>;

type SubmitFormDataFn<TInfo extends RouteWithActionModule> =
	HasNoParams<TInfo["route"]> extends true
		? (
				path: TInfo["route"],
				formData: FormData,
				submittedData?: FormDataSubmittedData,
				options?: SubmitFormDataOptions,
			) => SubmitJsonResult<ActionResult<TInfo>>
		: HasOptionalParams<TInfo["route"]> extends true
			? (
					path: TInfo["route"],
					args: RouteParams<TInfo["route"]> | undefined,
					formData: FormData,
					submittedData?: FormDataSubmittedData,
					options?: SubmitFormDataOptions,
				) => SubmitJsonResult<ActionResult<TInfo>>
			: (
					path: TInfo["route"],
					args: RouteParams<TInfo["route"]>,
					formData: FormData,
					submittedData?: FormDataSubmittedData,
					options?: SubmitFormDataOptions,
				) => SubmitJsonResult<ActionResult<TInfo>>;

export type UseConcurrentSubmitterReturn<TInfo extends RouteWithActionModule> =
	{
		operations: Record<
			string,
			Operation<
				ActionResult<TInfo>,
				z.infer<TInfo["formSchema"]> | FormDataSubmittedData
			>
		>;
		submitJson: SubmitJsonFn<TInfo>;
		submitFormData: SubmitFormDataFn<TInfo>;
	};

export function useConcurrentSubmitter<
	TInfo extends RouteWithActionModule,
>(): UseConcurrentSubmitterReturn<TInfo> {
	const ctx = useContext(ConcurrentSubmitterContext);
	if (!ctx) {
		throw new Error(
			"useConcurrentSubmitter must be used within a ConcurrentSubmitterProvider",
		);
	}

	function isRouteParams(obj: unknown): obj is Record<string, string> {
		return (
			typeof obj === "object" &&
			obj !== null &&
			!Array.isArray(obj) &&
			obj instanceof FormData === false &&
			Object.values(obj as Record<string, unknown>).every(
				(v) => typeof v === "string",
			)
		);
	}

	const submitJson = useCallback(
		(path: string, ...rest: unknown[]) => {
			if (rest.length === 1) {
				return ctx.addJsonSubmission(path, undefined, rest[0], undefined);
			}
			if (rest.length === 2 && rest[0] === undefined) {
				return ctx.addJsonSubmission(path, undefined, rest[1], undefined);
			}
			if (rest.length === 2 && !isRouteParams(rest[0])) {
				const [data, options] = rest as [
					Record<string, unknown>,
					SubmitJsonOptions | undefined,
				];
				return ctx.addJsonSubmission(path, undefined, data, options);
			}
			const [args, data, options] = rest as [
				Record<string, string> | undefined,
				Record<string, unknown>,
				SubmitJsonOptions | undefined,
			];
			return ctx.addJsonSubmission(path, args, data, options);
		},
		[ctx],
	) as UseConcurrentSubmitterReturn<TInfo>["submitJson"];

	const submitFormData = useCallback(
		(path: string, ...rest: unknown[]) => {
			const second = rest[0];
			if (second instanceof FormData) {
				const formData = second;
				const submittedData =
					rest.length >= 2 ? (rest[1] as FormDataSubmittedData) : {};
				const options =
					rest.length === 3 ? (rest[2] as SubmitFormDataOptions) : undefined;
				return ctx.addFormSubmission(
					path,
					undefined,
					formData,
					submittedData,
					options,
				);
			}
			const args = second as Record<string, string>;
			const formData = rest[1] as FormData;
			const submittedData =
				rest.length >= 3 ? (rest[2] as FormDataSubmittedData) : {};
			const options = (rest.length === 4 ? rest[3] : undefined) as
				| SubmitFormDataOptions
				| undefined;
			return ctx.addFormSubmission(
				path,
				args,
				formData,
				submittedData,
				options,
			);
		},
		[ctx],
	) as UseConcurrentSubmitterReturn<TInfo>["submitFormData"];

	return {
		operations:
			ctx.operations as UseConcurrentSubmitterReturn<TInfo>["operations"],
		submitJson,
		submitFormData,
	};
}
