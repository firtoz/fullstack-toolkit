import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import * as ReactRouter from "react-router";

const mockHref = mock((path: string, ...args: unknown[]) => {
	if (args.length === 0) return path;
	const params = args[0] as Record<string, string>;
	const query = new URLSearchParams(params).toString();
	return query ? `${path}?${query}` : path;
});

const fetcherSetters = new Map<
	string,
	{
		setState: (s: "idle" | "submitting") => void;
		setData: (d: unknown) => void;
	}
>();

function mockUseFetcher(opts: { key: string }) {
	const [state, setState] = React.useState<"idle" | "submitting">("idle");
	const [data, setData] = React.useState<unknown>(undefined);
	React.useEffect(() => {
		fetcherSetters.set(opts.key, { setState, setData });
		return () => {
			fetcherSetters.delete(opts.key);
		};
	}, [opts.key]);
	const submit = React.useCallback(() => setState("submitting"), []);
	return { submit, state, data };
}

mock.module("react-router", () => ({
	...ReactRouter,
	href: mockHref,
	useFetcher: mockUseFetcher,
}));

import {
	ConcurrentSubmitterProvider,
	type FormDataSubmittedData,
	type SubmitFormDataOptions,
	type SubmitJsonOptions,
	type SubmitJsonResult,
} from "./ConcurrentSubmitterProvider";
import { useConcurrentSubmitter } from "./useConcurrentSubmitter";

/** Test helper: no-params API so we can call submitJson(path, data) and submitFormData(path, formData, ...) without args */
type NoParamsTestApi = {
	operations: Record<string, unknown>;
	submitJson: (
		path: string,
		data: unknown,
		options?: SubmitJsonOptions,
	) => SubmitJsonResult<unknown>;
	submitFormData: (
		path: string,
		formData: FormData,
		submittedData?: FormDataSubmittedData,
		options?: SubmitFormDataOptions,
	) => SubmitJsonResult<unknown>;
};

function wrapper({ children }: { children: React.ReactNode }) {
	return React.createElement(ConcurrentSubmitterProvider, null, children);
}

function assertDefined<T>(value: T | undefined | null, label = "value"): T {
	if (value === undefined || value === null) {
		throw new Error(`Expected ${label} to be defined`);
	}
	return value;
}

/** Mock fetcher state for an operation id — same as `assertDefined(fetcherSetters.get(id))`. */
function getFetcherSetters(opId: string) {
	return assertDefined(fetcherSetters.get(opId), `fetcher setters for ${opId}`);
}

describe("ConcurrentSubmitterProvider + useConcurrentSubmitter", () => {
	beforeEach(() => {
		mockHref.mockClear();
		mockHref.mockImplementation((path: string, ...args: unknown[]) => {
			if (args.length === 0) return path;
			const params = args[0] as Record<string, string>;
			const query = new URLSearchParams(params).toString();
			return query ? `${path}?${query}` : path;
		});
		fetcherSetters.clear();
	});

	afterEach(() => {
		fetcherSetters.clear();
	});

	it("useConcurrentSubmitter throws without provider", () => {
		expect(() => renderHook(() => useConcurrentSubmitter())).toThrow(
			"useConcurrentSubmitter must be used within a ConcurrentSubmitterProvider",
		);
	});

	it("uses href to build action URL when adding submission", () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		act(() => {
			result.current.submitJson("/api/upload", { id: "123" }, { x: 1 });
		});
		expect(mockHref).toHaveBeenCalledWith("/api/upload", { id: "123" });
	});

	it("submitJson adds operation with pending status and returns id and promise", () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		const api = result.current as unknown as NoParamsTestApi;
		let submitted!: SubmitJsonResult<unknown>;
		act(() => {
			submitted = api.submitJson("/api/upload", { name: "a" });
		});
		expect(submitted.id).toMatch(/^op-\d+$/);
		expect(submitted.promise).toBeInstanceOf(Promise);
		const opId = submitted.id;
		expect(result.current.operations[opId]).toBeDefined();
		expect(result.current.operations[opId].status).toBe("pending");
		expect(result.current.operations[opId].submittedData).toEqual({
			name: "a",
		});
	});

	it("operation becomes done when fetcher settles with data", async () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		const api = result.current as unknown as NoParamsTestApi;
		let opId = "";
		act(() => {
			const out = api.submitJson("/api/upload", {
				name: "test",
			});
			opId = out.id;
		});
		expect(opId).toMatch(/^op-\d+$/);
		await act(async () => {
			// Flush so FetcherRunner mounts and submit() is called
		});
		const response = { success: true, id: "server-1" };
		act(() => {
			const s = getFetcherSetters(opId);
			s.setData(response);
			s.setState("idle");
		});
		await waitFor(() => {
			expect(result.current.operations[opId].status).toBe("done");
			expect(result.current.operations[opId].data).toEqual(response);
			expect(result.current.operations[opId].submittedData).toEqual({
				name: "test",
			});
		});
	});

	it("promise from submitJson resolves with data when settled", async () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		const api = result.current as unknown as NoParamsTestApi;
		let opId = "";
		let resolved: unknown;
		act(() => {
			const out = api.submitJson("/api/upload", {
				key: "v",
			});
			opId = out.id;
			out.promise.then((d) => {
				resolved = d;
			});
		});
		expect(opId).toMatch(/^op-\d+$/);
		await act(async () => {});
		const response = { value: 42 };
		act(() => {
			const s = getFetcherSetters(opId);
			s.setData(response);
			s.setState("idle");
		});
		await waitFor(() =>
			expect(result.current.operations[opId].status).toBe("done"),
		);
		await act(async () => {});
		expect(resolved).toEqual(response);
	});

	it("operation becomes error when fetcher settles with error", async () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		const api = result.current as unknown as NoParamsTestApi;
		let opId = "";
		act(() => {
			const out = api.submitJson("/api/upload", { x: 1 });
			opId = out.id;
			void out.promise.catch(() => {}); // consume rejection
		});
		expect(opId).toMatch(/^op-\d+$/);
		await act(async () => {});
		// FetcherRunner treats "idle" with no data as error (Submission failed)
		act(() => {
			getFetcherSetters(opId).setState("idle");
			// leave data undefined -> onSettle gets error
		});
		await waitFor(() => {
			expect(result.current.operations[opId].status).toBe("error");
			expect(result.current.operations[opId].error).toBeDefined();
		});
	});

	it("each operation has unique id and independent pending -> done", async () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		const api = result.current as unknown as NoParamsTestApi;
		let aId = "";
		let bId = "";
		let cId = "";
		act(() => {
			aId = api.submitJson("/api/upload", {
				name: "a",
			}).id;
		});
		act(() => {
			bId = api.submitJson("/api/upload", {
				name: "b",
			}).id;
		});
		act(() => {
			cId = api.submitJson("/api/upload", {
				name: "c",
			}).id;
		});
		expect(aId).toMatch(/^op-\d+$/);
		expect(bId).toMatch(/^op-\d+$/);
		expect(cId).toMatch(/^op-\d+$/);
		expect(new Set([aId, bId, cId]).size).toBe(3);
		await act(async () => {});
		expect(result.current.operations[aId].status).toBe("pending");
		expect(result.current.operations[bId].status).toBe("pending");
		expect(result.current.operations[cId].status).toBe("pending");

		act(() => {
			const s = getFetcherSetters(aId);
			s.setData({ ok: "a" });
			s.setState("idle");
		});
		await waitFor(() =>
			expect(result.current.operations[aId].status).toBe("done"),
		);
		expect(result.current.operations[aId].data).toEqual({ ok: "a" });
		expect(result.current.operations[bId].status).toBe("pending");
		expect(result.current.operations[cId].status).toBe("pending");

		act(() => {
			const s = getFetcherSetters(bId);
			s.setData({ ok: "b" });
			s.setState("idle");
		});
		await waitFor(() =>
			expect(result.current.operations[bId].status).toBe("done"),
		);
		act(() => {
			const s = getFetcherSetters(cId);
			s.setData({ ok: "c" });
			s.setState("idle");
		});
		await waitFor(() =>
			expect(result.current.operations[cId].status).toBe("done"),
		);
		expect(result.current.operations[aId].submittedData).toEqual({ name: "a" });
		expect(result.current.operations[bId].submittedData).toEqual({ name: "b" });
		expect(result.current.operations[cId].submittedData).toEqual({ name: "c" });
	});

	it("submitFormData adds operation with submittedData for display", async () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		const api = result.current as unknown as NoParamsTestApi;
		const formData = new FormData();
		formData.set("file", "blob" as unknown as File);
		const displayData = { type: "upload", label: "photo.jpg" };
		let opId = "";
		act(() => {
			opId = api.submitFormData("/api/upload", formData, displayData).id;
		});
		expect(opId).toMatch(/^op-\d+$/);
		expect(result.current.operations[opId].submittedData).toEqual(displayData);
		await act(async () => {});
		act(() => {
			const s = getFetcherSetters(opId);
			s.setData({ fileId: "abc" });
			s.setState("idle");
		});
		await waitFor(() => {
			expect(result.current.operations[opId].status).toBe("done");
			expect(result.current.operations[opId].data).toEqual({ fileId: "abc" });
			expect(result.current.operations[opId].submittedData).toEqual(
				displayData,
			);
		});
	});

	it("submitFormData defaults submittedData to empty object when omitted", () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		const api = result.current as unknown as NoParamsTestApi;
		let opId = "";
		act(() => {
			opId = api.submitFormData("/api/upload", new FormData()).id;
		});
		expect(opId).toMatch(/^op-\d+$/);
		expect(result.current.operations[opId].submittedData).toEqual({});
	});

	it("uses href without args when args is undefined", () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		const api = result.current as unknown as NoParamsTestApi;
		act(() => {
			api.submitJson("/api/upload", { x: 1 });
		});
		expect(mockHref).toHaveBeenCalledWith("/api/upload");
	});
});
