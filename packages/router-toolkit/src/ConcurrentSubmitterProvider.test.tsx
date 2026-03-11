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

import { ConcurrentSubmitterProvider } from "./ConcurrentSubmitterProvider";
import { useConcurrentSubmitter } from "./useConcurrentSubmitter";

function wrapper({ children }: { children: React.ReactNode }) {
	return React.createElement(ConcurrentSubmitterProvider, null, children);
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
		let out: { id: string; promise: Promise<unknown> } | undefined;
		act(() => {
			out = result.current.submitJson("/api/upload", undefined, { name: "a" });
		});
		expect(out).toBeDefined();
		expect(out!.id).toMatch(/^op-\d+$/);
		expect(out!.promise).toBeInstanceOf(Promise);
		const opId = out!.id;
		expect(result.current.operations[opId]).toBeDefined();
		expect(result.current.operations[opId].status).toBe("pending");
		expect(result.current.operations[opId].submittedData).toEqual({
			name: "a",
		});
	});

	it("operation becomes done when fetcher settles with data", async () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		let opId!: string;
		act(() => {
			const out = result.current.submitJson("/api/upload", undefined, {
				name: "test",
			});
			opId = out.id;
		});
		await act(async () => {
			// Flush so FetcherRunner mounts and submit() is called
		});
		const setters = fetcherSetters.get(opId);
		expect(setters).toBeDefined();
		const response = { success: true, id: "server-1" };
		act(() => {
			setters!.setData(response);
			setters!.setState("idle");
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
		let opId!: string;
		let resolved: unknown;
		act(() => {
			const out = result.current.submitJson("/api/upload", undefined, {
				key: "v",
			});
			opId = out.id;
			out.promise.then((d) => {
				resolved = d;
			});
		});
		await act(async () => {});
		const response = { value: 42 };
		act(() => {
			fetcherSetters.get(opId)!.setData(response);
			fetcherSetters.get(opId)!.setState("idle");
		});
		await waitFor(() =>
			expect(result.current.operations[opId].status).toBe("done"),
		);
		await act(async () => {});
		expect(resolved).toEqual(response);
	});

	it("operation becomes error when fetcher settles with error", async () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		let opId!: string;
		act(() => {
			const out = result.current.submitJson("/api/upload", undefined, { x: 1 });
			opId = out.id;
			void out.promise.catch(() => {}); // consume rejection
		});
		await act(async () => {});
		// FetcherRunner treats "idle" with no data as error (Submission failed)
		act(() => {
			fetcherSetters.get(opId)!.setState("idle");
			// leave data undefined -> onSettle gets error
		});
		await waitFor(() => {
			expect(result.current.operations[opId].status).toBe("error");
			expect(result.current.operations[opId].error).toBeDefined();
		});
	});

	it("each operation has unique id and independent pending -> done", async () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		let aId!: string;
		let bId!: string;
		let cId!: string;
		act(() => {
			aId = result.current.submitJson("/api/upload", undefined, {
				name: "a",
			}).id;
		});
		act(() => {
			bId = result.current.submitJson("/api/upload", undefined, {
				name: "b",
			}).id;
		});
		act(() => {
			cId = result.current.submitJson("/api/upload", undefined, {
				name: "c",
			}).id;
		});
		expect(new Set([aId, bId, cId]).size).toBe(3);
		await act(async () => {});
		expect(result.current.operations[aId].status).toBe("pending");
		expect(result.current.operations[bId].status).toBe("pending");
		expect(result.current.operations[cId].status).toBe("pending");

		act(() => {
			fetcherSetters.get(aId)!.setData({ ok: "a" });
			fetcherSetters.get(aId)!.setState("idle");
		});
		await waitFor(() =>
			expect(result.current.operations[aId].status).toBe("done"),
		);
		expect(result.current.operations[aId].data).toEqual({ ok: "a" });
		expect(result.current.operations[bId].status).toBe("pending");
		expect(result.current.operations[cId].status).toBe("pending");

		act(() => {
			fetcherSetters.get(bId)!.setData({ ok: "b" });
			fetcherSetters.get(bId)!.setState("idle");
		});
		await waitFor(() =>
			expect(result.current.operations[bId].status).toBe("done"),
		);
		act(() => {
			fetcherSetters.get(cId)!.setData({ ok: "c" });
			fetcherSetters.get(cId)!.setState("idle");
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
		const formData = new FormData();
		formData.set("file", "blob" as unknown as File);
		const displayData = { type: "upload", label: "photo.jpg" };
		let opId!: string;
		act(() => {
			opId = result.current.submitFormData(
				"/api/upload",
				undefined,
				formData,
				displayData,
			).id;
		});
		expect(result.current.operations[opId].submittedData).toEqual(displayData);
		await act(async () => {});
		act(() => {
			fetcherSetters.get(opId)!.setData({ fileId: "abc" });
			fetcherSetters.get(opId)!.setState("idle");
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
		let opId!: string;
		act(() => {
			opId = result.current.submitFormData(
				"/api/upload",
				undefined,
				new FormData(),
			).id;
		});
		expect(result.current.operations[opId].submittedData).toEqual({});
	});

	it("uses href without args when args is undefined", () => {
		const { result } = renderHook(() => useConcurrentSubmitter(), { wrapper });
		act(() => {
			result.current.submitJson("/api/upload", undefined, { x: 1 });
		});
		expect(mockHref).toHaveBeenCalledWith("/api/upload");
	});
});
