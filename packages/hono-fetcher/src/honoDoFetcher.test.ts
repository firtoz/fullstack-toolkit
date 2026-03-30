import { describe, expect, it, spyOn } from "bun:test";
import { honoDoFetcher } from "./honoDoFetcher";
import type { DOWithHonoApp } from "./honoDoFetcher";

type TestFetchStub = Pick<DurableObjectStub<DOWithHonoApp>, "fetch">;

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
});
