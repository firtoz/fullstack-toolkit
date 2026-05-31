import type { Hono, Schema } from "hono";
import type { ExtractSchema } from "hono/types";
import {
	honoFetcher,
	type BaseDisposableTypedHonoFetcher,
	type TypedHonoFetcher,
} from "./honoFetcher";

const DUMMY_URL = "http://dummy-url";

export type DOWithHonoApp<S extends Schema = Schema> =
	Rpc.DurableObjectBranded & {
		// biome-ignore lint/suspicious/noExplicitAny: We need to be able to pass in any schema
		app: Hono<any, S>;
	};

/**
 * Nameable RPC surface for a Durable Object class that exposes a Hono `app`.
 * Use when exporting types for `Env` bindings (avoids Alchemy `TS2883` when the
 * full DO class type cannot be named in generated declarations).
 *
 * @example
 * ```ts
 * export type ChatroomDoRpc = DoRpcWithApp<ChatroomDo>;
 * // Env: { CHATROOM: DurableObjectNamespace<ChatroomDoRpc> }
 * ```
 */
export type DoRpcWithApp<T extends { app: Hono }> = Rpc.DurableObjectBranded &
	Pick<T, "app">;

export type DOSchemaMap<T extends DOWithHonoApp> = T extends DOWithHonoApp
	? ExtractSchema<T["app"]>
	: never;

export type DOSchemaKeys<T extends DOWithHonoApp> = string &
	keyof DOSchemaMap<T>;

export type DOStubSchema<T extends DurableObjectStub> =
	T extends DurableObjectStub<infer S>
		? S extends DOWithHonoApp
			? ExtractSchema<S["app"]>
			: never
		: never;

/**
 * Fetcher for a **real** `DurableObjectStub`: HTTP results are {@link RpcDisposableJsonResponse}
 * and `websocket` returns `Response & Disposable`, matching Workers RPC when the runtime attaches
 * disposers. Use with {@link honoDoFetcher} / {@link honoDoFetcherWithName} / {@link honoDoFetcherWithId}
 * when `T` is a full stub—not with a minimal `Pick<stub, "fetch">` mock (that path uses plain
 * {@link TypedHonoFetcher} responses instead).
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/
 */
export type TypedDoFetcher<T extends DurableObjectStub> =
	BaseDisposableTypedHonoFetcher<
		// biome-ignore lint/suspicious/noExplicitAny: Generic parameter needs flexibility
		Hono<any, DOStubSchema<T>>
	>;

/**
 * Argument to {@link honoDoFetcher}: a **full** {@link DurableObjectStub} (production) or a minimal
 * **`{ fetch }`** mock. Only the full stub is typed as {@link TypedDoFetcher} with disposable RPC
 * responses; **`Pick<stub, "fetch">`** is typed as {@link TypedHonoFetcher} for `Hono` with ordinary
 * `JsonResponse` / `Response` (no `Disposable` on results—matches mocks without `Symbol.dispose`).
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/
 */
export type HonoDoFetcherStubInput =
	| DurableObjectStub<DOWithHonoApp>
	| Pick<DurableObjectStub<DOWithHonoApp>, "fetch">;

function withStubDispose<
	TStub extends Pick<DurableObjectStub<DOWithHonoApp>, "fetch">,
	TS extends Schema,
>(
	stub: TStub,
	// biome-ignore lint/suspicious/noExplicitAny: Matches honoFetcher generic pattern for schema-driven apps
	api: TypedHonoFetcher<Hono<any, TS>>,
	// biome-ignore lint/suspicious/noExplicitAny: Matches honoFetcher generic pattern for schema-driven apps
): TypedHonoFetcher<Hono<any, TS>> & Disposable {
	return Object.assign(api, {
		[Symbol.dispose]() {
			// Stubs may omit Symbol.dispose (e.g. Vite mocks); DurableObjectStub types may not list it.
			const disposeFn = Reflect.get(stub, Symbol.dispose);
			if (typeof disposeFn !== "function") {
				return;
			}
			try {
				disposeFn.call(stub);
			} catch (e) {
				console.error(
					"[@firtoz/hono-fetcher] Durable Object stub dispose failed",
					e,
				);
			}
		},
	});
}

/**
 * Typed fetcher for a Durable Object stub.
 *
 * - **Full `DurableObjectStub`:** return type is {@link TypedDoFetcher} **`& Disposable`** — each
 *   HTTP/WebSocket result is typed as disposable (`RpcDisposableJsonResponse` / `Response & Disposable`)
 *   so **`using res = await …`** type-checks when `"ESNext.Disposable"` is in `lib`, matching Workers RPC
 *   when the runtime attaches `[Symbol.dispose]` (see `@see` below).
 * - **`Pick<stub, "fetch">` only (e.g. tests):** return type is **`TypedHonoFetcher<Hono> & Disposable`**
 *   — same **`JsonResponse` / `Response`** shapes as {@link honoFetcher}; results are **not** typed as
 *   `Disposable` so typings are not faked for mocks that lack RPC disposers.
 *
 * Disposing only the fetcher (`using api = …`) releases the **stub**; RPC **`Response`** disposal
 * (when applicable) is separate — prefer **`using res`**, **`res[Symbol.dispose]()`**, or **`DisposableStack`**.
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/
 */
export const honoDoFetcher = <const T extends HonoDoFetcherStubInput>(
	durableObject: T,
): T extends DurableObjectStub<DOWithHonoApp>
	? TypedDoFetcher<T> & Disposable
	: TypedHonoFetcher<Hono> & Disposable => {
	type OutSchema =
		T extends DurableObjectStub<DOWithHonoApp> ? DOStubSchema<T> : Schema;
	// biome-ignore lint/suspicious/noExplicitAny: Generic parameter needs flexibility
	const api = honoFetcher<Hono<any, OutSchema>>((url, init) => {
		return durableObject.fetch(`${DUMMY_URL}${url}`, init);
	});
	return withStubDispose(
		durableObject,
		api,
	) as T extends DurableObjectStub<DOWithHonoApp>
		? TypedDoFetcher<T> & Disposable
		: TypedHonoFetcher<Hono> & Disposable;
};

export const honoDoFetcherWithName = <
	const T extends Rpc.DurableObjectBranded & DOWithHonoApp,
>(
	namespace: DurableObjectNamespace<T>,
	name: string,
): TypedDoFetcher<DurableObjectStub<T>> & Disposable => {
	return honoDoFetcher(namespace.getByName(name)) as TypedDoFetcher<
		DurableObjectStub<T>
	> &
		Disposable;
};

export const honoDoFetcherWithId = <
	const T extends Rpc.DurableObjectBranded & DOWithHonoApp,
>(
	namespace: DurableObjectNamespace<T>,
	id: string,
): TypedDoFetcher<DurableObjectStub<T>> & Disposable => {
	return honoDoFetcher(
		namespace.get(namespace.idFromString(id)),
	) as TypedDoFetcher<DurableObjectStub<T>> & Disposable;
};
