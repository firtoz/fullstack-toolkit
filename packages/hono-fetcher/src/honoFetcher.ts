import type { Hono } from "hono";
import type { ExtractSchema } from "hono/types";

export type ParsePathParams<T extends string> =
	T extends `${infer _Start}/:${infer Param}/${infer Rest}`
		? { [K in Param | keyof ParsePathParams<`/${Rest}`>]: string }
		: T extends `${infer _Start}/:${infer Param}`
			? { [K in Param]: string }
			: never;

export type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

export type HonoSchemaKeys<T extends Hono> = string & keyof ExtractSchema<T>;

type FilterKeysByMethod<
	TApp extends ExtractSchema<unknown>,
	TMethod extends HttpMethod,
> = {
	[K in keyof TApp as TApp[K] extends { [key in `$${TMethod}`]: unknown }
		? K
		: never]: TApp[K];
};

type HonoSchema<TApp extends Hono> = {
	[M in HttpMethod]: FilterKeysByMethod<ExtractSchema<TApp>, M>;
};

export type JsonResponse<T> = Omit<Response, "json"> & {
	json: () => Promise<T>;
};

type HasPathParams<T extends string> = T extends `${string}:${string}`
	? true
	: false;

type FetcherParams<SchemaPath extends string> =
	HasPathParams<SchemaPath> extends true
		? {
				params: ParsePathParams<SchemaPath>;
				init?: RequestInit;
			}
		: {
				params?: never;
				init?: RequestInit;
			};

// biome-ignore lint/complexity/noBannedTypes: We need an empty object to remove the body and form keys from the request object
type EmptyObject = {};

type TypedMethodFetcher<T extends Hono, M extends HttpMethod> = <
	SchemaPath extends string & keyof HonoSchema<T>[M],
>(
	request: {
		url: SchemaPath;
	} & FetcherParams<SchemaPath> &
		(M extends "get" | "delete" ? EmptyObject : BodyParams<T, M, SchemaPath>),
) => Promise<SchemaOutput<T, M, SchemaPath>>;

type SchemaOutput<
	T extends Hono,
	M extends HttpMethod,
	SchemaPath extends string & keyof HonoSchema<T>[M],
	DollarM extends `$${M}` & keyof HonoSchema<T>[M][SchemaPath] = `$${M}` &
		keyof HonoSchema<T>[M][SchemaPath],
> = "output" extends keyof HonoSchema<T>[M][SchemaPath][DollarM]
	? JsonResponse<HonoSchema<T>[M][SchemaPath][DollarM]["output"]>
	: never;

type BodyParams<
	TApp extends Hono,
	TMethod extends HttpMethod,
	SchemaPath extends string & keyof HonoSchema<TApp>[TMethod],
	DollarMethod extends `$${TMethod}` &
		keyof HonoSchema<TApp>[TMethod][SchemaPath] = `$${TMethod}` &
		keyof HonoSchema<TApp>[TMethod][SchemaPath],
> = "input" extends keyof HonoSchema<TApp>[TMethod][SchemaPath][DollarMethod]
	? "json" extends keyof HonoSchema<TApp>[TMethod][SchemaPath][DollarMethod]["input"]
		? "form" extends keyof HonoSchema<TApp>[TMethod][SchemaPath][DollarMethod]["input"]
			?
					| {
							body: HonoSchema<TApp>[TMethod][SchemaPath][DollarMethod]["input"]["json"];
					  }
					| {
							form: HonoSchema<TApp>[TMethod][SchemaPath][DollarMethod]["input"]["form"];
					  }
			: {
					body: HonoSchema<TApp>[TMethod][SchemaPath][DollarMethod]["input"]["json"];
				}
		: "form" extends keyof HonoSchema<TApp>[TMethod][SchemaPath][DollarMethod]["input"]
			? {
					form: HonoSchema<TApp>[TMethod][SchemaPath][DollarMethod]["input"]["form"];
				}
			: { body?: unknown } | { form?: unknown }
	: EmptyObject;

type AvailableMethods<T extends Hono> = {
	[M in HttpMethod]: keyof HonoSchema<T>[M] extends never ? never : M;
}[HttpMethod];

export type BaseTypedHonoFetcher<T extends Hono> = {
	[M in AvailableMethods<T>]: TypedMethodFetcher<T, M>;
};

const createMethodFetcher = <T extends Hono, M extends HttpMethod>(
	fetcher: (
		request: string,
		init?: RequestInit,
	) => ReturnType<T["request"]> | Promise<ReturnType<T["request"]>>,
	method: M,
): TypedMethodFetcher<T, M> => {
	return (async (request) => {
		let finalUrl: string = request.url;

		const { init = {}, params } = request;

		if (params && typeof params === "object") {
			finalUrl = Object.entries(params).reduce((acc, [key, value]) => {
				return acc.replace(`:${key}`, value as string);
			}, finalUrl);
		}

		const requestAsOptionalFormBody = request as {
			form?: unknown;
			body?: unknown;
		};

		let body: BodyInit | undefined;
		if (requestAsOptionalFormBody.form) {
			const formData = new FormData();
			for (const [key, value] of Object.entries(
				requestAsOptionalFormBody.form,
			)) {
				formData.append(key, value as string);
			}
			body = formData;
		} else if (requestAsOptionalFormBody.body) {
			body = JSON.stringify(requestAsOptionalFormBody.body) as BodyInit;
		}

		// biome-ignore lint/suspicious/noExplicitAny: Different runtimes have incompatible HeadersInit types
		const newHeaders = new Headers(init.headers as any);

		if (body && !requestAsOptionalFormBody.form) {
			newHeaders.set("Content-Type", "application/json");
		}

		try {
			return await fetcher(finalUrl, {
				method: method.toUpperCase(),
				headers: newHeaders,
				...(body ? { body } : {}),
				...init,
			});
		} catch (error) {
			console.error(`Error ${method}ing`, error);
			throw new Error(`Failed to ${method} ${finalUrl}: ${error}`);
		}
	}) as TypedMethodFetcher<T, M>;
};

export type TypedHonoFetcher<T extends Hono> = BaseTypedHonoFetcher<T>;

export const honoFetcher = <T extends Hono>(
	fetcher: (
		request: string,
		init?: RequestInit,
	) => ReturnType<T["request"]> | Promise<ReturnType<T["request"]>>,
): TypedHonoFetcher<T> => {
	const methods = ["get", "post", "put", "delete", "patch"] as const;

	const result = methods.reduce(
		(acc, method) => {
			(
				acc as TypedHonoFetcher<T> & {
					[M in typeof method]: TypedMethodFetcher<T, M>;
				}
			)[method] = createMethodFetcher(fetcher, method) as TypedMethodFetcher<
				T,
				typeof method
			>;
			return acc;
		},
		{} as TypedHonoFetcher<T>,
	);

	return result;
};
