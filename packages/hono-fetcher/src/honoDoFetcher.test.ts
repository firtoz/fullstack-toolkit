import { describe, expect, it, spyOn } from "bun:test";
import { Hono } from "hono";
import type { BaseDisposableTypedHonoFetcher } from "./honoFetcher";
import { honoDoFetcher } from "./honoDoFetcher";
import type { DOWithHonoApp } from "./honoDoFetcher";

/** Minimal app shape so `TypedHonoFetcher` exposes `.get` in tests. */
const testRouteApp = new Hono().get("/x", (c) => c.json({ ok: true }));
type TestRouteApp = typeof testRouteApp;

type TestFetchStub = Pick<DurableObjectStub<DOWithHonoApp>, "fetch">;

function responseWithRpcDispose(onDispose: () => void): Response {
	const res = new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
	return Object.defineProperty(res, Symbol.dispose, {
		value() {
			onDispose();
		},
		configurable: true,
		writable: true,
	}) as Response;
}

describe("honoDoFetcher disposal", () => {
	it("does not throw when stub has no Symbol.dispose (dev / mocks)", () => {
		const stub: TestFetchStub = {
			fetch: async () =>
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		};
		const api = honoDoFetcher(stub);
		expect(() => {
			api[Symbol.dispose]();
		}).not.toThrow();
	});

	it("calls stub Symbol.dispose when present", () => {
		let disposeCalls = 0;
		const stub: TestFetchStub & Pick<Disposable, typeof Symbol.dispose> = {
			fetch: async () =>
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			[Symbol.dispose]() {
				disposeCalls += 1;
			},
		};
		const api = honoDoFetcher(stub);
		api[Symbol.dispose]();
		expect(disposeCalls).toBe(1);
	});

	it("swallows dispose errors and logs (avoids SuppressedError masking user errors)", () => {
		const stub: TestFetchStub & Pick<Disposable, typeof Symbol.dispose> = {
			fetch: async () =>
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			[Symbol.dispose]() {
				throw new Error("dispose failed");
			},
		};
		const api = honoDoFetcher(stub);
		const consoleError = spyOn(console, "error").mockImplementation(() => {});
		expect(() => {
			api[Symbol.dispose]();
		}).not.toThrow();
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});

	it("does not dispose RPC Response until `using` unwinds (simulates full stub typing)", async () => {
		let responseDisposeCalls = 0;
		const stub: TestFetchStub = {
			fetch: async () =>
				responseWithRpcDispose(() => {
					responseDisposeCalls += 1;
				}),
		};
		await (async () => {
			// `Pick<stub,"fetch">` is typed as plain `TypedHonoFetcher` (no `Disposable` on responses).
			// Cast to the production stub shape to assert `using resp` + RPC dispose behavior.
			using api = honoDoFetcher(
				stub,
			) as BaseDisposableTypedHonoFetcher<TestRouteApp> & Disposable;
			using resp = await api.get({ url: "/x" });
			await resp.json();
			expect(responseDisposeCalls).toBe(0);
		})();
		expect(responseDisposeCalls).toBe(1);
	});
});
