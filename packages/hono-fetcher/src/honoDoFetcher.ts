import type { Hono, Schema } from "hono";
import type { ExtractSchema } from "hono/types";
import { honoFetcher, type TypedHonoFetcher } from "./honoFetcher";

const DUMMY_URL = "http://dummy-url";

export type DOWithHonoApp<S extends Schema = Schema> =
	Rpc.DurableObjectBranded & {
		// biome-ignore lint/suspicious/noExplicitAny: We need to be able to pass in any schema
		app: Hono<any, S>;
	};

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

export type TypedDoFetcher<T extends DurableObjectStub> = TypedHonoFetcher<
	// biome-ignore lint/suspicious/noExplicitAny: Generic parameter needs flexibility
	Hono<any, DOStubSchema<T>>
>;

/** Shape honoDoFetcher uses at runtime; full stubs or minimal mocks (e.g. tests) with only `fetch`. */
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
