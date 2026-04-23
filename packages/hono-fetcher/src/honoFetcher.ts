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

/**
 * {@link JsonResponse} intersected with `Disposable` for Workers RPC: `Response`
 * values from `DurableObjectStub#fetch()` may implement `[Symbol.dispose]` even
 * though `Fetcher.fetch` is still typed as `Promise<Response>`. Use with
 * {@link BaseDisposableTypedHonoFetcher} (and `TypedDoFetcher` from `./honoDoFetcher`) so
 * `using resp = await api.get(...)` type-checks when `"ESNext.Disposable"` is in `lib`.
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/
 */
export type RpcDisposableJsonResponse<T> = JsonResponse<T> & Disposable;

type HasPathParams<T extends string> = T extends `${string}:${string}`
	? true
	: false;

/**
 * Values allowed in the optional `query` object on fetcher requests.
 * `null` and `undefined` entries are omitted from the serialized query string.
 */
export type HonoFetcherQueryParamValue = string | number | boolean;

export type HonoFetcherQueryParams = Record<
	string,
	HonoFetcherQueryParamValue | null | undefined
>;

function appendQueryString(
	url: string,
	query?: HonoFetcherQueryParams,
): string {
	if (!query) {
		return url;
	}
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null) {
			continue;
		}
		searchParams.append(key, String(value));
	}
	const serialized = searchParams.toString();
	if (!serialized) {
		return url;
	}
	const separator = url.includes("?") ? "&" : "?";
	return `${url}${separator}${serialized}`;
}

/**
 * `RequestInit` fields that honoFetcher sets must not be overwritten by spreading `...init` last.
 */
function restOfRequestInit(
	init: RequestInit,
): Omit<RequestInit, "headers" | "body" | "method"> {
	const { headers: _h, body: _b, method: _m, ...rest } = init;
	return rest;
}

type FetcherParams<SchemaPath extends string> =
	HasPathParams<SchemaPath> extends true
		? {
				params: ParsePathParams<SchemaPath>;
				query?: HonoFetcherQueryParams;
				init?: RequestInit;
			}
		: {
				params?: never;
				query?: HonoFetcherQueryParams;
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

type DoSchemaOutput<
	T extends Hono,
	M extends HttpMethod,
	SchemaPath extends string & keyof HonoSchema<T>[M],
	DollarM extends `$${M}` & keyof HonoSchema<T>[M][SchemaPath] = `$${M}` &
		keyof HonoSchema<T>[M][SchemaPath],
> = "output" extends keyof HonoSchema<T>[M][SchemaPath][DollarM]
	? RpcDisposableJsonResponse<HonoSchema<T>[M][SchemaPath][DollarM]["output"]>
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

export interface WebSocketConfig {
	/**
	 * Whether to automatically call accept() on the WebSocket before returning.
	 * Defaults to true for convenience.
	 *
	 * In Cloudflare Workers, you must call accept() before using a WebSocket.
	 * Setting this to false allows you to call accept() manually if needed.
	 *
	 * @default true
	 */
	autoAccept?: boolean;
	/**
	 * Arguments for Cloudflare’s `WebSocket#accept` (e.g. `{ allowHalfOpen: true }` when
	 * [proxying](https://developers.cloudflare.com/workers/runtime-apis/websockets/#close-behavior)
	 * and coordinating close on both sides). Used only when `autoAccept` is true.
	 */
	acceptOptions?: WebSocketAcceptOptions;
}

export type TypedWebSocketFetcher<T extends Hono> = <
	SchemaPath extends string & keyof HonoSchema<T>["get"],
>(
	request: {
		url: SchemaPath;
		config?: WebSocketConfig;
	} & FetcherParams<SchemaPath>,
) => Promise<Response>;

export type BaseTypedHonoFetcher<T extends Hono> = {
	[M in AvailableMethods<T>]: TypedMethodFetcher<T, M>;
} & (keyof HonoSchema<T>["get"] extends never
	? // biome-ignore lint/complexity/noBannedTypes: We really do want an empty object if the get method is not available
		{}
	: { websocket: TypedWebSocketFetcher<T> });

type TypedDisposableMethodFetcher<T extends Hono, M extends HttpMethod> = <
	SchemaPath extends string & keyof HonoSchema<T>[M],
>(
	request: {
		url: SchemaPath;
	} & FetcherParams<SchemaPath> &
		(M extends "get" | "delete" ? EmptyObject : BodyParams<T, M, SchemaPath>),
) => Promise<DoSchemaOutput<T, M, SchemaPath>>;

export type TypedDisposableWebSocketFetcher<T extends Hono> = <
	SchemaPath extends string & keyof HonoSchema<T>["get"],
>(
	request: {
		url: SchemaPath;
		config?: WebSocketConfig;
	} & FetcherParams<SchemaPath>,
) => Promise<Response & Disposable>;

/**
 * Same shape as {@link BaseTypedHonoFetcher} but HTTP methods return
 * {@link RpcDisposableJsonResponse} and `websocket` returns `Response & Disposable`
 * so `using` on RPC results type-checks for Durable Object clients.
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/
 */
export type BaseDisposableTypedHonoFetcher<T extends Hono> = {
	[M in AvailableMethods<T>]: TypedDisposableMethodFetcher<T, M>;
} & (keyof HonoSchema<T>["get"] extends never
	? // biome-ignore lint/complexity/noBannedTypes: We really do want an empty object if the get method is not available
		{}
	: { websocket: TypedDisposableWebSocketFetcher<T> });

const createMethodFetcher = <T extends Hono, M extends HttpMethod>(
	fetcher: (
		request: string,
		init?: RequestInit,
	) => ReturnType<T["request"]> | Promise<ReturnType<T["request"]>>,
	method: M,
): TypedMethodFetcher<T, M> => {
	return (async (request) => {
		let finalUrl: string = request.url;

		const { init = {}, params, query } = request;

		if (params && typeof params === "object") {
			finalUrl = Object.entries(params).reduce((acc, [key, value]) => {
				return acc.replace(`:${key}`, value as string);
			}, finalUrl);
		}

		finalUrl = appendQueryString(finalUrl, query);

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

		const newHeaders = new Headers(
			init.headers as unknown as ConstructorParameters<typeof Headers>[0],
		);

		if (body && !requestAsOptionalFormBody.form) {
			newHeaders.set("Content-Type", "application/json");
		}

		try {
			return await fetcher(finalUrl, {
				...restOfRequestInit(init),
				method: method.toUpperCase(),
				headers: newHeaders,
				...(body ? { body } : {}),
			});
		} catch (error) {
			console.error(`Error ${method}ing`, error);
			throw new Error(`Failed to ${method} ${finalUrl}: ${error}`);
		}
	}) as TypedMethodFetcher<T, M>;
};

const createWebSocketFetcher = <T extends Hono>(
	fetcher: (
		request: string,
		init?: RequestInit,
	) => ReturnType<T["request"]> | Promise<ReturnType<T["request"]>>,
): TypedWebSocketFetcher<T> => {
	return (async (request) => {
		let finalUrl: string = request.url;

		const { init = {}, params, query, config } = request;
		const autoAccept = config?.autoAccept ?? true;
		const acceptOptions = config?.acceptOptions;

		if (params && typeof params === "object") {
			finalUrl = Object.entries(params).reduce((acc, [key, value]) => {
				return acc.replace(`:${key}`, value as string);
			}, finalUrl);
		}

		finalUrl = appendQueryString(finalUrl, query);

		const newHeaders = new Headers(
			init.headers as unknown as ConstructorParameters<typeof Headers>[0],
		);
		newHeaders.set("Upgrade", "websocket");

		try {
			const response = await fetcher(finalUrl, {
				...restOfRequestInit(init),
				method: "GET",
				headers: newHeaders,
			});

			if (autoAccept && response.webSocket) {
				response.webSocket.accept(acceptOptions);
			}

			return response;
		} catch (error) {
			console.error("Error upgrading to WebSocket", error);
			throw new Error(`Failed to upgrade WebSocket at ${finalUrl}: ${error}`);
		}
	}) as TypedWebSocketFetcher<T>;
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

	// Add websocket method
	(
		result as TypedHonoFetcher<T> & { websocket?: TypedWebSocketFetcher<T> }
	).websocket = createWebSocketFetcher(fetcher);

	return result;
};
