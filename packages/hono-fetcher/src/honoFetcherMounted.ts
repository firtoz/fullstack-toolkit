import type { Hono } from "hono";
import { Hono as HonoClass } from "hono";
import type { Env, Schema } from "hono/types";
import type { ExtractSchema } from "hono/types";
import {
	honoFetcher,
	type ParsePathParams,
	type TypedHonoFetcher,
} from "./honoFetcher";

type SchemaRouteKeys<T extends Hono> = string & keyof ExtractSchema<T>;

/**
 * Client-side view of a Hono app: same routes/schema as the server app but without
 * server `Bindings` (service-binding and browser clients do not send Worker env).
 *
 * Use with a **sub-app** type when the mount path is only on the worker (e.g. mount
 * `/admin` but routes on the type are `/users`). For typed mount prefixes derived from
 * full worker paths, pass the **worker app** type and use {@link MountedClientApp}.
 */
export type HonoClientApp<T extends Hono> =
	T extends Hono<
		infer E extends Env,
		infer S extends Schema,
		infer BasePath extends string
	>
		? Hono<Omit<E, "Bindings">, S, BasePath>
		: never;

type HasMorePathSegments<Rest extends string> = Rest extends
	| `${string}/${string}`
	| `:${string}/${string}`
	? true
	: false;

type MountPrefixesWithPrefix<
	Prefix extends string,
	Route extends string,
> = Route extends `/${infer Seg}/${infer Rest}`
	? HasMorePathSegments<Rest> extends true
		?
				| `${Prefix}/${Seg}`
				| MountPrefixesWithPrefix<`${Prefix}/${Seg}`, `/${Rest}`>
		: `${Prefix}/${Seg}`
	: never;

/** Every mount prefix along a route (`/a/b/c` → `/a` | `/a/b`). */
type MountPrefixesOfRoute<Route extends string> =
	Route extends `/${infer Seg}/${infer Rest}`
		? HasMorePathSegments<Rest> extends true
			? `/${Seg}` | MountPrefixesWithPrefix<`/${Seg}`, `/${Rest}`>
			: `/${Seg}`
		: never;

/**
 * Mount prefix valid when the worker app schema has routes under `${M}/…`.
 * Includes multi-segment prefixes (`/nested/deep`) and param segments (`/level1/:param`).
 * Excludes top-level-only routes (`/users`, `/x`) — use {@link honoFetcher} for those.
 */
export type ValidMountPrefix<T extends Hono> = MountPrefixesOfRoute<
	SchemaRouteKeys<T>
>;

/** Path params required when the mount path contains `:param` segments. */
export type MountPathParams<M extends string> = ParsePathParams<M>;

type StripMountRoute<
	Route extends string,
	Mount extends string,
> = Route extends `${Mount}/${infer Rest}` ? `/${Rest}` : never;

type MountedSchema<T extends Hono, Mount extends string> = {
	[Route in SchemaRouteKeys<T> as StripMountRoute<
		Route,
		Mount
	> extends infer Stripped extends string
		? Stripped
		: never]: ExtractSchema<T>[Route];
} & Schema;

/**
 * Client view of routes under `Mount` on a **worker app** whose schema keys are full
 * paths (e.g. `/admin/users` → client `url: "/users"` when `Mount` is `"/admin"`).
 */
export type MountedClientApp<T extends Hono, Mount extends string> =
	T extends Hono<
		infer E extends Env,
		infer _S extends Schema,
		infer BasePath extends string
	>
		? Hono<Omit<E, "Bindings">, MountedSchema<T, Mount>, BasePath>
		: never;

type ClientAppForMount<T extends Hono, M extends string> =
	M extends ValidMountPrefix<T> ? MountedClientApp<T, M> : HonoClientApp<T>;

type MountParamsArg<M extends string> =
	ParsePathParams<M> extends never ? undefined : ParsePathParams<M>;

function normalizeMountPath(mountPath: string): string {
	const trimmed = mountPath.trim();
	if (trimmed === "" || trimmed === "/") {
		return "";
	}
	const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
	return withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
}

function substitutePathParams(
	path: string,
	params: Record<string, string>,
): string {
	return Object.entries(params).reduce(
		(acc, [key, value]) => acc.replace(`:${key}`, value),
		path,
	);
}

function joinMountedRequest(prefix: string, request: string): string {
	const qIndex = request.indexOf("?");
	const pathPart = qIndex === -1 ? request : request.slice(0, qIndex);
	const queryPart = qIndex === -1 ? "" : request.slice(qIndex);
	const normalized = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
	const suffix = normalized === "/" ? "" : normalized;

	if (prefix === "") {
		return `${suffix || "/"}${queryPart}`;
	}
	return `${prefix}${suffix}${queryPart}`;
}

type ParentFetcher = (
	request: string,
	init?: RequestInit,
) => Response | Promise<Response>;

function createMountedFetcher<
	T extends Hono,
	const M extends ValidMountPrefix<T> | string,
>(
	parentFetcher: ParentFetcher,
	mountPath: M,
	mountParams?: MountParamsArg<M>,
): TypedHonoFetcher<
	M extends ValidMountPrefix<T> ? MountedClientApp<T, M> : HonoClientApp<T>
> {
	const normalized = normalizeMountPath(mountPath);
	const prefix =
		mountParams === undefined
			? normalized
			: substitutePathParams(normalized, mountParams as Record<string, string>);
	return honoFetcher<ClientAppForMount<T, M>>((request, init) => {
		const url = joinMountedRequest(prefix, request);
		return parentFetcher(url, init) as ReturnType<
			ClientAppForMount<T, M>["request"]
		>;
	}) as TypedHonoFetcher<
		M extends ValidMountPrefix<T> ? MountedClientApp<T, M> : HonoClientApp<T>
	>;
}

function isHonoApp(value: ParentFetcher | Hono): value is Hono {
	return value instanceof HonoClass;
}

/**
 * Typed client for routes under `mountPath`, using `app.request` as transport.
 * Infers both the app schema and (when valid) stripped mount paths — no type args needed.
 *
 * When `mountPath` contains `:param` segments, pass `mountParams` (same shape as route
 * `params` on {@link honoFetcher}).
 */
export function honoFetcherMounted<
	T extends Hono,
	const M extends ValidMountPrefix<T>,
>(
	app: T,
	mountPath: M,
	mountParams: MountPathParams<M>,
): TypedHonoFetcher<MountedClientApp<T, M>>;

export function honoFetcherMounted<
	T extends Hono,
	const M extends ValidMountPrefix<T>,
>(app: T, mountPath: M): TypedHonoFetcher<MountedClientApp<T, M>>;

/**
 * Typed client for routes under `mountPath` on a parent fetcher.
 *
 * Use when transport is not `app.request` (service bindings, DO stubs, browser `fetch`, etc.).
 *
 * - **Worker app type** (schema keys include the mount, e.g. `/admin/users`): pass
 *   `typeof workerApp` and a {@link ValidMountPrefix}; client `url` values are paths
 *   **after** the mount (`/users`, not `/admin/users`). Prefer {@link honoFetcherMounted}
 *   with the app instance when using `app.request`.
 * - **Sub-app type** (routes are `/users` on the sub-app, mount is only on the worker):
 *   pass `typeof adminRoutes` and the worker mount string (`"/admin"`); client URLs
 *   match the sub-app schema.
 */
export function honoFetcherMounted<T extends Hono>(
	parentFetcher: ParentFetcher,
	mountPath: string,
	mountParams?: Record<string, string>,
): TypedHonoFetcher<HonoClientApp<T>>;

export function honoFetcherMounted<
	T extends Hono,
	const M extends ValidMountPrefix<T>,
>(
	parentFetcher: ParentFetcher,
	mountPath: M,
	mountParams: MountPathParams<M>,
): TypedHonoFetcher<MountedClientApp<T, M>>;

export function honoFetcherMounted<
	T extends Hono,
	const M extends ValidMountPrefix<T>,
>(
	parentFetcher: ParentFetcher,
	mountPath: M,
): TypedHonoFetcher<MountedClientApp<T, M>>;

export function honoFetcherMounted<
	T extends Hono,
	const M extends ValidMountPrefix<T> | string,
>(
	appOrFetcher: T | ParentFetcher,
	mountPath: M,
	mountParams?: MountParamsArg<M>,
): TypedHonoFetcher<HonoClientApp<T> | MountedClientApp<T, M>> {
	const parentFetcher = isHonoApp(appOrFetcher)
		? (url: string, init?: RequestInit) => appOrFetcher.request(url, init)
		: appOrFetcher;
	return createMountedFetcher<T, M>(
		parentFetcher,
		mountPath,
		mountParams,
	) as TypedHonoFetcher<HonoClientApp<T> | MountedClientApp<T, M>>;
}
