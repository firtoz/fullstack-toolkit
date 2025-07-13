import { useCallback, useMemo } from "react";
import {
	type FetcherFormProps,
	href,
	type SubmitOptions,
	type SubmitTarget,
	useFetcher,
} from "react-router";
import type { z } from "zod/v4";
import type { Func } from "./types/Func";
import type { HrefArgs } from "./types/HrefArgs";
import type { RegisterPages } from "./types/RegisterPages";

type RouteModule = {
	route: keyof RegisterPages;
	action: Func;
	formSchema: z.ZodType;
};

type SubmitFunc<TModule extends RouteModule> = (
	target: z.infer<TModule["formSchema"]> & SubmitTarget,
	options: Omit<SubmitOptions, "action" | "method" | "encType"> & {
		method: Exclude<SubmitOptions["method"], "GET">;
	},
) => Promise<void>;

type SubmitForm = (
	props: Omit<
		FetcherFormProps & React.RefAttributes<HTMLFormElement>,
		"action" | "method"
	> & {
		method: Exclude<SubmitOptions["method"], "GET">;
	},
) => React.ReactElement;

export const useDynamicSubmitter = <TInfo extends RouteModule>(
	path: TInfo["route"],
	...args: TInfo["route"] extends "undefined"
		? HrefArgs<"/">
		: HrefArgs<TInfo["route"]>
): Omit<
	ReturnType<typeof useFetcher<TInfo["action"]>>,
	"load" | "submit" | "Form"
> & {
	submit: SubmitFunc<TInfo>;
	Form: SubmitForm;
} => {
	const url = useMemo(() => {
		// biome-ignore lint/suspicious/noExplicitAny: Typechecks complain about this so we need to cast to any
		return (href as any)(path, ...args);
	}, [path, args]);

	const fetcher = useFetcher<TInfo["action"]>({
		key: `submitter-${url}`,
	});

	const submit: SubmitFunc<TInfo> = useCallback(
		(target, options) => {
			// console.log("Submitting form to", url, target, options);
			return fetcher.submit(target, {
				...options,
				action: url,
				encType: "multipart/form-data",
			});
		},
		[fetcher.submit, url],
	);

	const OriginalForm = fetcher.Form;

	const Form: SubmitForm = useCallback(
		(props) => {
			return <OriginalForm action={url} {...props} />;
		},
		[url, OriginalForm],
	);

	return {
		...fetcher,
		submit,
		Form,
	};
};
