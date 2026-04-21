import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import * as ReactRouter from "react-router";

const mockSubmit = mock((_target: unknown, _options?: unknown) => {});
const mockForm = mock((props: React.PropsWithChildren<{ action?: string }>) => {
	return React.createElement("form", props);
});

type FetcherSetter = {
	setState: (s: "idle" | "submitting" | "loading") => void;
	setData: (d: unknown) => void;
	setError: (e: unknown | undefined) => void;
};

type FetcherSharedSnap = {
	state: "idle" | "submitting" | "loading";
	data: unknown;
	error: unknown | undefined;
};

type FetcherSharedStore = {
	snap: FetcherSharedSnap;
	listeners: Set<() => void>;
};

const fetcherStores = new Map<string, FetcherSharedStore>();

function getOrCreateFetcherStore(key: string): FetcherSharedStore {
	let s = fetcherStores.get(key);
	if (!s) {
		s = {
			snap: { state: "idle", data: undefined, error: undefined },
			listeners: new Set(),
		};
		fetcherStores.set(key, s);
	}
	return s;
}

function notifyFetcherListeners(key: string) {
	const s = fetcherStores.get(key);
	if (!s) return;
	for (const l of s.listeners) {
		l();
	}
}

const mockHref = mock((path: string, ...args: unknown[]) => {
	if (args.length === 0) {
		return path;
	}
	const params = args[0] as Record<string, string>;
	const queryString = new URLSearchParams(params).toString();
	return queryString ? `${path}?${queryString}` : path;
});

function mockUseFetcherImpl(opts: { key: string }) {
	const subscribe = React.useCallback(
		(onStoreChange: () => void) => {
			const store = getOrCreateFetcherStore(opts.key);
			store.listeners.add(onStoreChange);
			return () => {
				store.listeners.delete(onStoreChange);
			};
		},
		[opts.key],
	);

	const getSnapshot = React.useCallback(() => {
		return getOrCreateFetcherStore(opts.key).snap;
	}, [opts.key]);

	const snap = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	const submit = React.useCallback(
		(target: unknown, options?: unknown) => {
			mockSubmit(target, options);
			const store = getOrCreateFetcherStore(opts.key);
			store.snap = { ...store.snap, state: "submitting" };
			notifyFetcherListeners(opts.key);
		},
		[opts.key],
	);

	return {
		submit,
		Form: mockForm,
		state: snap.state,
		data: snap.data,
		error: snap.error,
		formData: null,
		json: null,
		text: null,
	};
}

const mockUseFetcher = mock(mockUseFetcherImpl);

mock.module("react-router", () => ({
	...ReactRouter,
	useFetcher: mockUseFetcher,
	href: mockHref,
}));

import type { SubmitTarget } from "react-router";
import { z } from "zod";
import type { $ZodAnyParams } from "zod/v4/core";
import {
	dynamicSubmitterFetcherKey,
	SubmitterSupersededError,
	SubmitterUnmountedError,
	useDynamicSubmitter,
	useDynamicSubmitterFetcher,
} from "./useDynamicSubmitter";

/** Minimal route module shape so `useDynamicSubmitter` infers `submit` / `submitJson` in tests. */
const testRouteFormSchema = z.unknown();

async function testSubmitterAction(): Promise<unknown> {
	return {};
}

type TestSubmitterModule = {
	route: "/api/submit" | "/test/path";
	formSchema: typeof testRouteFormSchema;
	action: typeof testSubmitterAction;
};

function renderApiSubmitter() {
	return renderHook(() =>
		useDynamicSubmitter<TestSubmitterModule>("/api/submit"),
	);
}

function renderTestPathSubmitter(...args: [] | [Record<string, string>]) {
	return renderHook(() =>
		args.length === 0
			? useDynamicSubmitter<TestSubmitterModule>("/test/path")
			: useDynamicSubmitter<TestSubmitterModule>("/test/path", args[0]),
	);
}

/** Two submitters to the same static route with distinct `keySuffix` options. */
function renderDualApiSubmitters(suffixA: string, suffixB: string) {
	return renderHook(() => {
		const submitterA = useDynamicSubmitter<TestSubmitterModule>("/api/submit", {
			keySuffix: suffixA,
		});
		const submitterB = useDynamicSubmitter<TestSubmitterModule>("/api/submit", {
			keySuffix: suffixB,
		});
		return { submitterA, submitterB };
	});
}

function getFetcherSettersForKey(key: string): FetcherSetter {
	return {
		setState: (st) => {
			const store = getOrCreateFetcherStore(key);
			store.snap = { ...store.snap, state: st };
			notifyFetcherListeners(key);
		},
		setData: (d) => {
			const store = getOrCreateFetcherStore(key);
			store.snap = { ...store.snap, data: d };
			notifyFetcherListeners(key);
		},
		setError: (e) => {
			const store = getOrCreateFetcherStore(key);
			store.snap = { ...store.snap, error: e };
			notifyFetcherListeners(key);
		},
	};
}

/** Same key as the hook: {@link dynamicSubmitterFetcherKey}(href(...), suffix) (uses mocked `href`). */
function submitterFetcherKey(
	path: string,
	hrefArgs?: Record<string, string>,
	keySuffix?: string,
): string {
	const url =
		hrefArgs !== undefined ? mockHref(path, hrefArgs) : mockHref(path);
	return dynamicSubmitterFetcherKey(url, keySuffix);
}

function settleFetcher(key: string, data: unknown) {
	const s = getFetcherSettersForKey(key);
	act(() => {
		s.setData(data);
		s.setState("idle");
	});
}

function settleFetcherWithError(key: string, err: Error) {
	const s = getFetcherSettersForKey(key);
	act(() => {
		s.setError(err);
		s.setData(undefined);
		s.setState("idle");
	});
}

/** Like RR: `submitting` → `loading` → `idle` before resolving the awaited promise. */
async function flushSubmitThroughLoading<T>(
	p: Promise<T>,
	key: string,
	data: unknown,
): Promise<T> {
	await act(async () => {});
	await act(async () => {
		getFetcherSettersForKey(key).setState("loading");
	});
	await act(async () => {});
	await act(async () => {
		settleFetcher(key, data);
	});
	const value = await p;
	await act(async () => {});
	return value;
}

/** Flush `submitting` from `submit` / `submitJson`, then transition to `idle` with data so the hook effect can settle. */
async function flushSubmitPromise<T>(
	p: Promise<T>,
	key: string,
	data: unknown,
): Promise<T> {
	await act(async () => {});
	await act(async () => {
		settleFetcher(key, data);
	});
	const value = await p;
	await act(async () => {});
	return value;
}

// Import after mocking

describe("useDynamicSubmitter", () => {
	beforeEach(() => {
		mockSubmit.mockClear();
		mockUseFetcher.mockClear();
		mockHref.mockClear();
		mockForm.mockClear();
		fetcherStores.clear();

		mockHref.mockImplementation((path: string, ...args: unknown[]) => {
			if (args.length === 0) {
				return path;
			}
			const params = args[0] as Record<string, string>;
			const queryString = new URLSearchParams(params).toString();
			return queryString ? `${path}?${queryString}` : path;
		});
	});

	afterEach(() => {
		fetcherStores.clear();
	});

	it("should call useFetcher with the correct key based on the generated URL", () => {
		renderTestPathSubmitter();

		expect(mockUseFetcher).toHaveBeenCalledWith({
			key: "submitter-/test/path",
		});
	});

	it("should generate correct URL using href function", () => {
		renderTestPathSubmitter({ id: "123" });

		expect(mockHref).toHaveBeenCalledWith("/test/path", { id: "123" });
	});

	it("should call submit with correct action and encType", async () => {
		const { result } = renderApiSubmitter();
		const key = submitterFetcherKey("/api/submit");
		const formData = {
			name: "test",
			email: "test@example.com",
		} as const;

		const p = result.current.submit(formData, { method: "POST" });
		await flushSubmitPromise(p, key, { ok: true });

		expect(mockSubmit).toHaveBeenCalledWith(formData, {
			method: "POST",
			action: "/api/submit",
			encType: "multipart/form-data",
		});
		expect(mockSubmit).toHaveBeenCalledTimes(1);
	});

	it("should handle multiple submit calls with different data", async () => {
		const { result } = renderApiSubmitter();
		const key = submitterFetcherKey("/api/submit");
		const formData1 = { name: "test1" } as SubmitTarget;
		const formData2 = { name: "test2" } as SubmitTarget;

		const p1 = result.current.submit(formData1, { method: "POST" });
		await flushSubmitPromise(p1, key, { n: 1 });

		const p2 = result.current.submit(formData2, { method: "PUT" });
		await flushSubmitPromise(p2, key, { n: 2 });

		expect(mockSubmit).toHaveBeenCalledTimes(2);
		expect(mockSubmit).toHaveBeenNthCalledWith(1, formData1, {
			method: "POST",
			action: "/api/submit",
			encType: "multipart/form-data",
		});
		expect(mockSubmit).toHaveBeenNthCalledWith(2, formData2, {
			method: "PUT",
			action: "/api/submit",
			encType: "multipart/form-data",
		});
	});

	it("should preserve custom options in submit", async () => {
		const { result } = renderApiSubmitter();
		const key = submitterFetcherKey("/api/submit");
		const formData = { name: "test" } as SubmitTarget;
		const p = result.current.submit(formData, {
			method: "POST",
			fetcherKey: "custom-key",
		});
		await flushSubmitPromise(p, key, {});

		expect(mockSubmit).toHaveBeenCalledWith(formData, {
			method: "POST",
			fetcherKey: "custom-key",
			action: "/api/submit",
			encType: "multipart/form-data",
		});
	});

	it("should return Form component with action set", () => {
		const { result } = renderApiSubmitter();

		expect(result.current.Form).toBeDefined();
		expect(typeof result.current.Form).toBe("function");

		const FormComponent = result.current.Form;
		const formElement = FormComponent({ method: "POST", children: null });

		expect(formElement).toBeDefined();
	});

	it("should default Form method to POST when not specified", () => {
		const { result } = renderApiSubmitter();

		const FormComponent = result.current.Form;
		const formElement = FormComponent({ children: null });

		expect(formElement).toBeDefined();
		expect(formElement.props).toMatchObject({
			action: "/api/submit",
			method: "POST",
		});
	});

	it("should allow overriding Form method", () => {
		const { result } = renderApiSubmitter();

		const FormComponent = result.current.Form;
		const formElement = FormComponent({ method: "PUT", children: null });

		expect(formElement.props).toMatchObject({
			action: "/api/submit",
			method: "PUT",
		});
	});

	it("returns submit, submitJson, Form, and fetcherKey (no fetcher spread)", () => {
		const { result } = renderApiSubmitter();

		expect(result.current).toHaveProperty("submit");
		expect(result.current).toHaveProperty("submitJson");
		expect(result.current).toHaveProperty("Form");
		expect(result.current).toHaveProperty("fetcherKey");
		expect(result.current).not.toHaveProperty("state");
		expect(result.current).not.toHaveProperty("data");
		expect(result.current).not.toHaveProperty("load");
	});

	it("exposes fetcherKey matching dynamicSubmitterFetcherKey for the resolved URL", () => {
		const { result } = renderApiSubmitter();
		expect(result.current.fetcherKey).toBe(
			dynamicSubmitterFetcherKey(mockHref("/api/submit")),
		);
	});

	it("accepts keySuffix after href params for dynamic routes", () => {
		const { result } = renderHook(() =>
			useDynamicSubmitter<TestSubmitterModule>(
				"/test/path",
				{ id: "1" },
				{ keySuffix: "pane-b" },
			),
		);
		const url = mockHref("/test/path", { id: "1" });
		expect(result.current.fetcherKey).toBe(
			dynamicSubmitterFetcherKey(url, "pane-b"),
		);
		expect(mockUseFetcher).toHaveBeenCalledWith({
			key: dynamicSubmitterFetcherKey(url, "pane-b"),
		});
	});

	it("includes keySuffix in fetcherKey and passes it to useFetcher", () => {
		const { result } = renderHook(() =>
			useDynamicSubmitter<TestSubmitterModule>("/api/submit", {
				keySuffix: "widget-a",
			}),
		);
		const expected = dynamicSubmitterFetcherKey(
			mockHref("/api/submit"),
			"widget-a",
		);
		expect(result.current.fetcherKey).toBe(expected);
		expect(mockUseFetcher).toHaveBeenCalledWith({ key: expected });
	});

	it("isolates fetcher keys for the same route when keySuffix differs", () => {
		renderHook(() =>
			useDynamicSubmitter<TestSubmitterModule>("/api/submit", {
				keySuffix: "a",
			}),
		);
		renderHook(() =>
			useDynamicSubmitter<TestSubmitterModule>("/api/submit", {
				keySuffix: "b",
			}),
		);
		const keyA = dynamicSubmitterFetcherKey(mockHref("/api/submit"), "a");
		const keyB = dynamicSubmitterFetcherKey(mockHref("/api/submit"), "b");
		expect(keyA).not.toBe(keyB);
		expect(mockUseFetcher).toHaveBeenNthCalledWith(1, { key: keyA });
		expect(mockUseFetcher).toHaveBeenNthCalledWith(2, { key: keyB });
	});

	it("useDynamicSubmitterFetcher uses the same key as the submitter", () => {
		renderHook(() => {
			const submitter = useDynamicSubmitter<TestSubmitterModule>("/api/submit");
			useDynamicSubmitterFetcher(submitter);
			return submitter;
		});
		expect(mockUseFetcher).toHaveBeenCalledTimes(2);
		const expectedKey = submitterFetcherKey("/api/submit");
		expect(mockUseFetcher.mock.calls[0]?.[0]).toEqual({ key: expectedKey });
		expect(mockUseFetcher.mock.calls[1]?.[0]).toEqual({ key: expectedKey });
	});

	describe("keySuffix: overlapping submissions on the same route", () => {
		it("resolves both submitJson promises when runs overlap (distinct fetcher keys)", async () => {
			const { result } = renderDualApiSubmitters("slot-a", "slot-b");
			const keyA = submitterFetcherKey("/api/submit", undefined, "slot-a");
			const keyB = submitterFetcherKey("/api/submit", undefined, "slot-b");

			const pA = result.current.submitterA.submitJson({ which: "a" });
			const pB = result.current.submitterB.submitJson({ which: "b" });

			await act(async () => {});
			await act(async () => {
				settleFetcher(keyA, { resolved: "a" });
			});
			await act(async () => {});
			await act(async () => {
				settleFetcher(keyB, { resolved: "b" });
			});

			const [vA, vB] = await Promise.all([pA, pB]);
			expect(vA as unknown).toEqual({ resolved: "a" });
			expect(vB as unknown).toEqual({ resolved: "b" });
		});

		it("settlement order can be interleaved; both promises still resolve", async () => {
			const { result } = renderDualApiSubmitters("p1", "p2");
			const keyA = submitterFetcherKey("/api/submit", undefined, "p1");
			const keyB = submitterFetcherKey("/api/submit", undefined, "p2");

			const pA = result.current.submitterA.submitJson({ k: "a" });
			const pB = result.current.submitterB.submitJson({ k: "b" });

			await act(async () => {});
			await act(async () => {
				settleFetcher(keyB, { order: 2 });
			});
			await act(async () => {});
			await act(async () => {
				settleFetcher(keyA, { order: 1 });
			});

			const [vA, vB] = await Promise.all([pA, pB]);
			expect(vA as unknown).toEqual({ order: 1 });
			expect(vB as unknown).toEqual({ order: 2 });
		});

		it("SubmitterSupersededError on one submitter does not reject the other submitter", async () => {
			const { result } = renderDualApiSubmitters("left", "right");
			const keyA = submitterFetcherKey("/api/submit", undefined, "left");
			const keyB = submitterFetcherKey("/api/submit", undefined, "right");

			const pA1 = result.current.submitterA.submitJson({ n: 1 });
			const pA2 = result.current.submitterA.submitJson({ n: 2 });
			const pB = result.current.submitterB.submitJson({ n: 3 });

			await expect(pA1).rejects.toBeInstanceOf(SubmitterSupersededError);

			await act(async () => {});
			await act(async () => {
				settleFetcher(keyB, { winner: "b" });
			});
			await act(async () => {});
			await act(async () => {
				settleFetcher(keyA, { winner: "a2" });
			});

			const [vA2, vB] = await Promise.all([pA2, pB]);
			expect(vA2 as unknown).toEqual({ winner: "a2" });
			expect(vB as unknown).toEqual({ winner: "b" });
		});

		it("overlapping submitJson with same dynamic href and params but different suffix both resolve", async () => {
			const { result } = renderHook(() => {
				const submitterA = useDynamicSubmitter<TestSubmitterModule>(
					"/test/path",
					{ id: "7" },
					{ keySuffix: "tab-a" },
				);
				const submitterB = useDynamicSubmitter<TestSubmitterModule>(
					"/test/path",
					{ id: "7" },
					{ keySuffix: "tab-b" },
				);
				return { submitterA, submitterB };
			});
			const url = mockHref("/test/path", { id: "7" });
			const keyA = dynamicSubmitterFetcherKey(url, "tab-a");
			const keyB = dynamicSubmitterFetcherKey(url, "tab-b");

			const pA = result.current.submitterA.submitJson({ t: "a" });
			const pB = result.current.submitterB.submitJson({ t: "b" });

			await act(async () => {});
			await act(async () => {
				settleFetcher(keyA, { tab: "a" });
			});
			await act(async () => {});
			await act(async () => {
				settleFetcher(keyB, { tab: "b" });
			});

			const [vA, vB] = await Promise.all([pA, pB]);
			expect(vA as unknown).toEqual({ tab: "a" });
			expect(vB as unknown).toEqual({ tab: "b" });
		});
	});

	describe("shared fetcher key (no keySuffix)", () => {
		it("rejects earlier submitJson from another hook instance when the fetcher key matches", async () => {
			const { result: ra } = renderHook(() =>
				useDynamicSubmitter<TestSubmitterModule>("/api/submit"),
			);
			const { result: rb } = renderHook(() =>
				useDynamicSubmitter<TestSubmitterModule>("/api/submit"),
			);
			const key = submitterFetcherKey("/api/submit");
			const pA = ra.current.submitJson({ cross: "a" });
			const pB = rb.current.submitJson({ cross: "b" });
			await expect(pA).rejects.toBeInstanceOf(SubmitterSupersededError);
			expect(
				(await flushSubmitPromise(pB, key, { winner: "b" })) as unknown,
			).toEqual({ winner: "b" });
		});

		it("useDynamicSubmitterFetcher sees the same data on two instances (shared key)", async () => {
			const { result: ra } = renderHook(() => {
				const submitter =
					useDynamicSubmitter<TestSubmitterModule>("/api/submit");
				const fetcher = useDynamicSubmitterFetcher(submitter);
				return { submitter, fetcher };
			});
			const { result: rb } = renderHook(() => {
				const submitter =
					useDynamicSubmitter<TestSubmitterModule>("/api/submit");
				const fetcher = useDynamicSubmitterFetcher(submitter);
				return { submitter, fetcher };
			});
			const key = submitterFetcherKey("/api/submit");
			const p = ra.current.submitter.submitJson({ shared: true });
			await flushSubmitPromise(p, key, { payload: "one-fetcher" });
			await act(async () => {});
			expect(ra.current.fetcher.data as unknown).toEqual({
				payload: "one-fetcher",
			});
			expect(rb.current.fetcher.data as unknown).toEqual({
				payload: "one-fetcher",
			});
		});
	});

	it("should call href with path and args", () => {
		const params = { id: "123" } as $ZodAnyParams;

		const { result } = renderTestPathSubmitter(params);

		expect(mockHref).toHaveBeenCalledWith("/test/path", params);

		expect(result.current).toHaveProperty("submit");
		expect(typeof result.current.submit).toBe("function");
	});

	it("should handle different HTTP methods", async () => {
		const { result } = renderApiSubmitter();
		const key = submitterFetcherKey("/api/submit");
		const formData = { name: "test" } as SubmitTarget;

		for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
			const p = result.current.submit(formData, { method });
			const data = await flushSubmitPromise(p, key, { method });
			expect(data as unknown).toEqual({ method });
		}

		expect(mockSubmit).toHaveBeenCalledTimes(4);
	});

	it("submitJson resolves with action data after idle (sequential)", async () => {
		const { result } = renderApiSubmitter();
		const key = submitterFetcherKey("/api/submit");
		const data1 = { name: "a", value: 1 };
		const data2 = { name: "b", value: 2 };

		const p1 = result.current.submitJson(data1, { method: "POST" });
		expect(
			(await flushSubmitPromise(p1, key, { result: "first" })) as unknown,
		).toEqual({
			result: "first",
		});

		const p2 = result.current.submitJson(data2, { method: "PUT" });
		expect(
			(await flushSubmitPromise(p2, key, { result: "second" })) as unknown,
		).toEqual({
			result: "second",
		});
	});

	it("rejects prior promise with SubmitterSupersededError when a new submit starts before idle", async () => {
		const { result } = renderApiSubmitter();
		const key = submitterFetcherKey("/api/submit");

		const p1 = result.current.submitJson({ x: 1 });
		const p2 = result.current.submitJson({ x: 2 });

		await expect(p1).rejects.toBeInstanceOf(SubmitterSupersededError);

		expect(
			(await flushSubmitPromise(p2, key, { winner: 2 })) as unknown,
		).toEqual({
			winner: 2,
		});
	});

	it("rejects first two promises when three submitJson calls overlap (triple supersede)", async () => {
		const { result } = renderApiSubmitter();
		const key = submitterFetcherKey("/api/submit");

		const p1 = result.current.submitJson({ n: 1 });
		const p2 = result.current.submitJson({ n: 2 });
		const p3 = result.current.submitJson({ n: 3 });

		await expect(p1).rejects.toBeInstanceOf(SubmitterSupersededError);
		await expect(p2).rejects.toBeInstanceOf(SubmitterSupersededError);

		expect(
			(await flushSubmitPromise(p3, key, { n: 3, ok: true })) as unknown,
		).toEqual({ n: 3, ok: true });
	});

	it("resolves after submitting → loading → idle (revalidation path)", async () => {
		const { result } = renderApiSubmitter();
		const key = submitterFetcherKey("/api/submit");

		const p = result.current.submitJson({ phase: "test" });
		const data = await flushSubmitThroughLoading(p, key, { phase: "done" });
		expect(data as unknown).toEqual({ phase: "done" });
	});

	it("rejects with fetcher.error when idle has no data but error is set", async () => {
		const { result } = renderApiSubmitter();
		const key = submitterFetcherKey("/api/submit");

		const p = result.current.submitJson({ x: 1 });
		const outcome = p.then(
			() => ({ kind: "ok" as const }),
			(error: unknown) => ({ kind: "err" as const, error }),
		);
		await act(async () => {});
		const simulatedErr = new Error("simulated fetcher failure");
		await act(async () => {
			settleFetcherWithError(key, simulatedErr);
		});
		const r = await outcome;
		expect(r.kind).toBe("err");
		if (r.kind === "err") {
			expect(r.error).toBe(simulatedErr);
		}
	});

	it("resolves with failure-shaped data (business / validation JSON); promise does not reject", async () => {
		const { result } = renderApiSubmitter();
		const key = submitterFetcherKey("/api/submit");

		const failurePayload = {
			success: false as const,
			error: { type: "handler" as const, error: "not allowed" },
		};
		const p = result.current.submitJson({ x: 1 });
		const data = (await flushSubmitPromise(p, key, failurePayload)) as unknown;
		expect(data).toEqual(failurePayload);
	});

	it("rejects pending promise with SubmitterUnmountedError on unmount", async () => {
		const { result, unmount } = renderApiSubmitter();
		const p = result.current.submitJson({ x: 1 });
		await act(async () => {});
		act(() => {
			unmount();
		});
		await expect(p).rejects.toBeInstanceOf(SubmitterUnmountedError);
	});

	describe("submitJson", () => {
		it("should call submit with correct action and application/json encType", async () => {
			const { result } = renderApiSubmitter();
			const key = submitterFetcherKey("/api/submit");
			const jsonData = {
				email: "user@example.com",
				password: "secret123",
				rememberMe: true,
			};

			const p = result.current.submitJson(jsonData, { method: "POST" });
			await flushSubmitPromise(p, key, {});

			expect(mockSubmit).toHaveBeenCalledWith(jsonData, {
				method: "POST",
				action: "/api/submit",
				encType: "application/json",
			});
			expect(mockSubmit).toHaveBeenCalledTimes(1);
		});

		it("should default to POST method when no options provided", async () => {
			const { result } = renderApiSubmitter();
			const key = submitterFetcherKey("/api/submit");
			const jsonData = {
				email: "user@example.com",
				password: "secret123",
			};

			const p = result.current.submitJson(jsonData);
			await flushSubmitPromise(p, key, {});

			expect(mockSubmit).toHaveBeenCalledWith(jsonData, {
				method: "POST",
				action: "/api/submit",
				encType: "application/json",
			});
		});

		it("should default to POST method when options provided without method", async () => {
			const { result } = renderApiSubmitter();
			const key = submitterFetcherKey("/api/submit");
			const jsonData = { name: "test" };

			const p = result.current.submitJson(jsonData, {
				fetcherKey: "custom-key",
			});
			await flushSubmitPromise(p, key, {});

			expect(mockSubmit).toHaveBeenCalledWith(jsonData, {
				method: "POST",
				fetcherKey: "custom-key",
				action: "/api/submit",
				encType: "application/json",
			});
		});

		it("should handle plain objects without SubmitTarget", async () => {
			const { result } = renderApiSubmitter();
			const key = submitterFetcherKey("/api/submit");
			const plainObject = {
				title: "My Post",
				content: "Post content here",
				published: false,
			};

			const p = result.current.submitJson(plainObject, { method: "POST" });
			await flushSubmitPromise(p, key, {});

			expect(mockSubmit).toHaveBeenCalledWith(plainObject, {
				method: "POST",
				action: "/api/submit",
				encType: "application/json",
			});
		});

		it("should handle multiple submitJson calls with different data", async () => {
			const { result } = renderApiSubmitter();
			const key = submitterFetcherKey("/api/submit");

			const data1 = { name: "test1", value: 1 };
			const data2 = { name: "test2", value: 2 };

			const p1 = result.current.submitJson(data1, { method: "POST" });
			await flushSubmitPromise(p1, key, { i: 1 });

			const p2 = result.current.submitJson(data2, { method: "PUT" });
			await flushSubmitPromise(p2, key, { i: 2 });

			expect(mockSubmit).toHaveBeenCalledTimes(2);
			expect(mockSubmit).toHaveBeenNthCalledWith(1, data1, {
				method: "POST",
				action: "/api/submit",
				encType: "application/json",
			});
			expect(mockSubmit).toHaveBeenNthCalledWith(2, data2, {
				method: "PUT",
				action: "/api/submit",
				encType: "application/json",
			});
		});

		it("should preserve custom options in submitJson", async () => {
			const { result } = renderApiSubmitter();
			const key = submitterFetcherKey("/api/submit");
			const jsonData = { name: "test" };

			const p = result.current.submitJson(jsonData, {
				method: "POST",
				fetcherKey: "custom-key",
			});
			await flushSubmitPromise(p, key, {});

			expect(mockSubmit).toHaveBeenCalledWith(jsonData, {
				method: "POST",
				fetcherKey: "custom-key",
				action: "/api/submit",
				encType: "application/json",
			});
		});

		it("should handle different HTTP methods with submitJson", async () => {
			const { result } = renderApiSubmitter();
			const key = submitterFetcherKey("/api/submit");
			const jsonData = { name: "test" };

			for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
				const p = result.current.submitJson(jsonData, { method });
				await flushSubmitPromise(p, key, { method });
				expect(mockSubmit).toHaveBeenLastCalledWith(
					jsonData,
					expect.objectContaining({
						method,
						encType: "application/json",
					}),
				);
			}

			expect(mockSubmit).toHaveBeenCalledTimes(4);
		});

		it("should use different encType than submit", async () => {
			const { result } = renderApiSubmitter();
			const key = submitterFetcherKey("/api/submit");
			const data = { name: "test" };

			const p1 = result.current.submit(data, { method: "POST" });
			await flushSubmitPromise(p1, key, {});
			expect(mockSubmit).toHaveBeenLastCalledWith(
				data,
				expect.objectContaining({ encType: "multipart/form-data" }),
			);

			const p2 = result.current.submitJson(data, { method: "POST" });
			await flushSubmitPromise(p2, key, {});
			expect(mockSubmit).toHaveBeenLastCalledWith(
				data,
				expect.objectContaining({ encType: "application/json" }),
			);
		});
	});

	it("submitJson is a function on the stable result object", () => {
		const { result } = renderApiSubmitter();

		expect(typeof result.current.submitJson).toBe("function");
	});

	it("keeps the same submitter object and submitJson reference when fetcher state changes", async () => {
		const { result } = renderApiSubmitter();
		const key = submitterFetcherKey("/api/submit");
		const before = result.current;
		const submitJsonBefore = result.current.submitJson;

		await act(async () => {
			getFetcherSettersForKey(key).setState("submitting");
		});

		expect(result.current).toBe(before);
		expect(result.current.submitJson).toBe(submitJsonBefore);
	});

	it("rejects when idle with undefined data and no fetcher error", async () => {
		const { result } = renderApiSubmitter();
		const key = submitterFetcherKey("/api/submit");

		const p = result.current.submitJson({ a: 1 });
		const outcome = p.then(
			() => ({ kind: "ok" as const }),
			(error: unknown) => ({ kind: "err" as const, error }),
		);
		await act(async () => {});
		await act(async () => {
			const s = getFetcherSettersForKey(key);
			s.setData(undefined);
			s.setState("idle");
		});
		const r = await outcome;
		expect(r.kind).toBe("err");
		if (r.kind === "err") {
			expect(r.error).toBeInstanceOf(Error);
			expect((r.error as Error).message).toBe("Submission failed");
		}
	});
});
