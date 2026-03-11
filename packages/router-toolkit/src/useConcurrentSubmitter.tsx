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

export type UseConcurrentSubmitterReturn<TInfo extends RouteWithActionModule> =
	{
		operations: Record<
			string,
			Operation<
				ActionResult<TInfo>,
				z.infer<TInfo["formSchema"]> | FormDataSubmittedData
			>
		>;
		submitJson: (
			path: TInfo["route"],
			args: RouteParams<TInfo["route"]> | undefined,
			data: z.infer<TInfo["formSchema"]>,
			options?: SubmitJsonOptions,
		) => SubmitJsonResult<ActionResult<TInfo>>;
		submitFormData: (
			path: TInfo["route"],
			args: RouteParams<TInfo["route"]> | undefined,
			formData: FormData,
			submittedData?: FormDataSubmittedData,
			options?: SubmitFormDataOptions,
		) => SubmitJsonResult<ActionResult<TInfo>>;
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

	const submitJson = useCallback(
		(
			path: string,
			args: Record<string, string> | undefined,
			data: unknown,
			options?: SubmitJsonOptions,
		) => ctx.addJsonSubmission(path, args, data, options),
		[ctx],
	) as UseConcurrentSubmitterReturn<TInfo>["submitJson"];

	const submitFormData = useCallback(
		(
			path: string,
			args: Record<string, string> | undefined,
			formData: FormData,
			submittedData: FormDataSubmittedData = {},
			options?: SubmitFormDataOptions,
		) => ctx.addFormSubmission(path, args, formData, submittedData, options),
		[ctx],
	) as UseConcurrentSubmitterReturn<TInfo>["submitFormData"];

	return {
		operations:
			ctx.operations as UseConcurrentSubmitterReturn<TInfo>["operations"],
		submitJson,
		submitFormData,
	};
}
