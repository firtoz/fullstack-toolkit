import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as ReactRouter from "react-router";

const mockHref = mock((path: string, ...args: unknown[]) => {
	if (args.length === 0) return path;
	const params = args[0] as Record<string, string>;
	const query = new URLSearchParams(params).toString();
	return query ? `${path}?${query}` : path;
});

mock.module("react-router", () => ({
	...ReactRouter,
	href: mockHref,
}));

import { useConcurrentDynamicSubmitter } from "./useConcurrentDynamicSubmitter";

/** Delay in ms */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("useConcurrentDynamicSubmitter", () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		mockHref.mockClear();
		mockHref.mockImplementation((path: string, ...args: unknown[]) => {
			if (args.length === 0) return path;
			const params = args[0] as Record<string, string>;
			const query = new URLSearchParams(params).toString();
			return query ? `${path}?${query}` : path;
		});
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("uses href to build action URL", () => {
		globalThis.fetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ success: true }),
			} as Response),
		) as unknown as typeof globalThis.fetch;
		renderHook(() =>
			useConcurrentDynamicSubmitter("/api/upload", { id: "123" } as never),
		);
		expect(mockHref).toHaveBeenCalledWith("/api/upload", { id: "123" });
	});

	it("tracks 5 submissions started 0.5s apart (action resolves after delay) - all show pending then done", async () => {
		// Simulates: action that resolves after delay; 5 fetches started 0.5s apart (shortened for test speed)
		const resolveAfterMs = 50;
		const delayBetweenStarts = 20;
		globalThis.fetch = mock(() =>
			delay(resolveAfterMs).then(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ success: true, value: "ok" }),
				} as Response),
			),
		) as unknown as typeof globalThis.fetch;

		const { result } = renderHook(() =>
			useConcurrentDynamicSubmitter("/api/upload"),
		);

		const submissions: ReturnType<typeof result.current.submitJson>[] = [];
		await act(async () => {
			for (let i = 0; i < 5; i++) {
				submissions.push(result.current.submitJson({ index: i } as never));
				await delay(delayBetweenStarts);
			}
		});

		// All 5 operations should exist; while fetch is in flight they are pending
		expect(Object.keys(result.current.operations).length).toBe(5);
		const statuses = Object.values(result.current.operations).map(
			(op) => op.status,
		);
		expect(statuses.every((s) => s === "pending" || s === "done")).toBe(true);

		await act(async () => {
			await Promise.all(submissions.map((s) => s.promise));
		});

		await waitFor(() => {
			const ops = result.current.operations;
			expect(Object.keys(ops).length).toBe(5);
			for (let i = 0; i < 5; i++) {
				const op = Object.values(ops).find(
					(o) => (o.submittedData as { index: number })?.index === i,
				);
				expect(op).toBeDefined();
				if (!op) continue;
				expect(op.status).toBe("done");
				expect(op.data).toEqual({ success: true, value: "ok" });
				expect(op.submittedData).toEqual({ index: i });
			}
		});
	});

	it("each operation has unique id and independent pending -> done", async () => {
		const resolveAfterMs = 80;
		globalThis.fetch = mock(() =>
			delay(resolveAfterMs).then(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ success: true }),
				} as Response),
			),
		) as unknown as typeof globalThis.fetch;

		const { result } = renderHook(() =>
			useConcurrentDynamicSubmitter("/api/upload"),
		);

		let a!: ReturnType<typeof result.current.submitJson>;
		let b!: ReturnType<typeof result.current.submitJson>;
		let c!: ReturnType<typeof result.current.submitJson>;
		await act(async () => {
			a = result.current.submitJson({ name: "a" } as never);
			await delay(30);
			b = result.current.submitJson({ name: "b" } as never);
			await delay(30);
			c = result.current.submitJson({ name: "c" } as never);
		});

		const aId = a?.id ?? "";
		const bId = b?.id ?? "";
		const cId = c?.id ?? "";
		expect(new Set([aId, bId, cId]).size).toBe(3);
		await waitFor(() => {
			expect(result.current.operations[aId].status).toBe("pending");
			expect(result.current.operations[bId].status).toBe("pending");
			expect(result.current.operations[cId].status).toBe("pending");
		});

		await act(async () => {
			const promises = [a, b, c]
				.filter(
					(
						x,
					): x is {
						id: string;
						promise: Promise<unknown>;
					} => x != null,
				)
				.map((x) => x.promise);
			await Promise.all(promises);
		});

		expect(result.current.operations[aId].status).toBe("done");
		expect(result.current.operations[bId].status).toBe("done");
		expect(result.current.operations[cId].status).toBe("done");
		expect(result.current.operations[aId].submittedData).toEqual({
			name: "a",
		});
		expect(result.current.operations[bId].submittedData).toEqual({
			name: "b",
		});
		expect(result.current.operations[cId].submittedData).toEqual({
			name: "c",
		});
	});

	it("reports error status when fetch fails", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve({
				ok: false,
				status: 500,
				text: () => Promise.resolve("Server error"),
			} as Response),
		) as unknown as typeof globalThis.fetch;

		const { result } = renderHook(() =>
			useConcurrentDynamicSubmitter("/api/upload"),
		);

		let id!: string;
		await act(() => {
			const out = result.current.submitJson({ x: 1 } as never);
			id = out.id;
			void out.promise.catch(() => {}); // consume rejection so it does not escape
		});

		const opId = id;
		await waitFor(
			() => {
				expect(result.current.operations[opId].status).toBe("error");
				expect(result.current.operations[opId].error).toBeDefined();
			},
			{ timeout: 500 },
		);

		const err = result.current.operations[opId].error as Error;
		expect(err?.message).toMatch(/Action failed/);
	});

	it("sends JSON body and POST by default", async () => {
		const mockFetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ success: true }),
			} as Response),
		);
		globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

		const { result } = renderHook(() =>
			useConcurrentDynamicSubmitter("/api/upload"),
		);

		const payload = { title: "Hello", count: 42 };
		await act(() => {
			result.current.submitJson(payload as never);
			return delay(0);
		});

		expect(mockFetch).toHaveBeenCalledWith(
			"/api/upload",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			}),
		);

		await waitFor(() => {
			const ops = Object.values(result.current.operations);
			expect(ops.length).toBe(1);
			expect(ops[0]?.submittedData).toEqual(payload);
			expect(ops[0]?.data).toEqual({ success: true });
		});
	});

	it("each operation has submittedData for optimistic display (pending) and data when done", async () => {
		let resolveFetch: () => void = () => {};
		const fetchPromise = new Promise<void>((r) => {
			resolveFetch = r;
		});
		globalThis.fetch = mock(() =>
			fetchPromise.then(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ saved: true, id: "server-123" }),
				} as Response),
			),
		) as unknown as typeof globalThis.fetch;

		const { result } = renderHook(() =>
			useConcurrentDynamicSubmitter("/api/upload"),
		);

		let id!: string;
		let promise!: Promise<unknown>;
		await act(() => {
			const out = result.current.submitJson({
				fileName: "doc.pdf",
				size: 1024,
			} as never);
			id = out.id;
			promise = out.promise;
		});

		const payload = { fileName: "doc.pdf", size: 1024 };
		const opId = id;
		const opPending = result.current.operations[opId];
		expect(opPending).toBeDefined();
		expect(opPending.status).toBe("pending");
		expect(opPending.submittedData).toEqual(payload);
		expect(opPending.data).toBeUndefined();

		await act(async () => {
			resolveFetch();
			await promise;
		});

		await waitFor(() => {
			const op = result.current.operations[opId];
			expect(op?.status).toBe("done");
			expect(op?.submittedData).toEqual(payload);
			expect(op?.data).toEqual({ saved: true, id: "server-123" });
		});
	});

	it("submitFormData sends FormData as body and uses optional submittedData for operations list", async () => {
		const mockFetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ success: true, fileId: "abc-123" }),
			} as Response),
		);
		globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

		const { result } = renderHook(() =>
			useConcurrentDynamicSubmitter("/api/upload"),
		);

		const formData = new FormData();
		formData.set("file", "blob placeholder" as unknown as File);
		const displayPayload = { type: "upload", label: "photo.jpg" };

		let id!: string;
		let promise!: Promise<unknown>;
		await act(() => {
			const out = result.current.submitFormData(formData, displayPayload);
			id = out.id;
			promise = out.promise;
		});

		expect(result.current.operations[id].submittedData).toEqual(displayPayload);

		await act(async () => {
			await promise;
		});

		await waitFor(() => {
			const op = result.current.operations[id];
			expect(op?.status).toBe("done");
			expect(op?.submittedData).toEqual(displayPayload);
			expect(op?.data).toEqual({ success: true, fileId: "abc-123" });
		});

		expect(mockFetch).toHaveBeenCalledWith(
			"/api/upload",
			expect.objectContaining({
				method: "POST",
				body: formData,
			}),
		);
	});

	it("submitFormData defaults submittedData to empty object when omitted", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ ok: true }),
			} as Response),
		) as unknown as typeof globalThis.fetch;

		const { result } = renderHook(() =>
			useConcurrentDynamicSubmitter("/api/upload"),
		);

		let id!: string;
		await act(() => {
			id = result.current.submitFormData(new FormData()).id;
		});

		expect(result.current.operations[id].submittedData).toEqual({});
	});

	it("submitFormData passes optional options (e.g. headers) to fetch", async () => {
		const mockFetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ ok: true }),
			} as Response),
		);
		globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

		const { result } = renderHook(() =>
			useConcurrentDynamicSubmitter("/api/upload"),
		);

		await act(() => {
			result.current.submitFormData(
				new FormData(),
				{},
				{
					headers: { Accept: "application/json" },
				},
			);
		});

		expect(mockFetch).toHaveBeenCalledWith(
			"/api/upload",
			expect.objectContaining({
				method: "POST",
				body: expect.any(FormData),
				headers: { Accept: "application/json" },
			}),
		);
	});
});
