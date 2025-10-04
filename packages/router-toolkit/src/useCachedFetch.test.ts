import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import * as ReactRouter from "react-router";

// Mock fetch
const mockFetch = mock((url: string) =>
	Promise.resolve({
		ok: true,
		status: 200,
		json: () => Promise.resolve({ data: "test-data", url }),
	}),
);

// Store original fetch
const originalFetch = globalThis.fetch;

// Mock href function
const mockHref = mock((path: string, ...args: unknown[]) => {
	if (args.length === 0) {
		return path;
	}
	const params = args[0] as Record<string, string>;
	const queryString = new URLSearchParams(params).toString();
	return queryString ? `${path}?${queryString}` : path;
});

// Mock react-router
mock.module("react-router", () => ({
	...ReactRouter,
	href: mockHref,
}));

// Import after mocking

// Type for test route paths
type TestRoutePath =
	| "/test/path"
	| "/api/test"
	| "/api/cached"
	| "/api/error"
	| "/api/network-error"
	| "/api/string-error"
	| "/api/test1"
	| "/api/test2"
	| "/api/same";

import { useCachedFetch } from "./useCachedFetch";

describe("useCachedFetch", () => {
	beforeEach(() => {
		// Set up fetch mock
		globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

		// Clear all mocks
		mockFetch.mockClear();
		mockHref.mockClear();

		// Reset fetch mock implementation
		mockFetch.mockImplementation((url: string) =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ data: "test-data", url }),
			} as Response),
		);

		// Clear the fetch cache by accessing the module's internal cache
		// Note: In a real scenario, you might want to expose a clearCache function
	});

	afterEach(() => {
		// Restore original fetch
		globalThis.fetch = originalFetch;
	});

	it("should initialize with undefined data and start loading", () => {
		const { result } = renderHook(() =>
			useCachedFetch("/test/path" as TestRoutePath),
		);

		// On mount, data should be undefined and it should start loading
		expect(result.current.data).toBeUndefined();
		expect(result.current.isLoading).toBe(true);
		expect(result.current.error).toBeUndefined();
	});

	it("should fetch data on mount", async () => {
		const { result } = renderHook(() =>
			useCachedFetch("/api/test" as TestRoutePath),
		);

		// Initially loading
		expect(result.current.isLoading).toBe(true);

		// Wait for data to load
		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.data).toBeDefined();
		expect(result.current.data).toMatchObject({
			data: "test-data",
			url: "/api/test",
		});
		expect(result.current.error).toBeUndefined();
		expect(mockFetch).toHaveBeenCalledWith("/api/test");
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("should use href to generate URL with params", async () => {
		const { result } = renderHook(() =>
			useCachedFetch("/api/test" as TestRoutePath, { id: "123" }),
		);

		expect(mockHref).toHaveBeenCalledWith("/api/test", { id: "123" });

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(mockFetch).toHaveBeenCalledWith("/api/test?id=123");
	});

	it("should cache fetched data and not refetch on remount", async () => {
		// First render
		const { result: result1, unmount } = renderHook(() =>
			useCachedFetch("/api/cached" as TestRoutePath),
		);

		await waitFor(() => {
			expect(result1.current.isLoading).toBe(false);
		});

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const firstData = result1.current.data;

		// Unmount
		unmount();

		// Clear mock calls but keep cache
		mockFetch.mockClear();

		// Second render with same URL
		const { result: result2 } = renderHook(() =>
			useCachedFetch("/api/cached" as TestRoutePath),
		);

		// Should have data immediately from cache
		expect(result2.current.data).toEqual(firstData);

		// Wait a bit to ensure no fetch happens
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Should not have called fetch again
		expect(mockFetch).toHaveBeenCalledTimes(0);
	});

	it("should handle fetch errors", async () => {
		// Mock fetch to fail
		mockFetch.mockImplementation(() =>
			Promise.resolve({
				ok: false,
				status: 404,
			} as Response),
		);
		const { result } = renderHook(() =>
			useCachedFetch("/api/error" as TestRoutePath),
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.data).toBeUndefined();
		expect(result.current.error).toBeDefined();
		expect(result.current.error?.message).toContain("HTTP error");
		expect(result.current.error?.message).toContain("404");
	});

	it("should handle network errors", async () => {
		// Mock fetch to throw
		mockFetch.mockImplementation(() =>
			Promise.reject(new Error("Network error")),
		);

		const { result } = renderHook(() =>
			useCachedFetch("/api/network-error" as TestRoutePath),
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.data).toBeUndefined();
		expect(result.current.error).toBeDefined();
		expect(result.current.error?.message).toBe("Network error");
	});

	it("should handle non-Error throws", async () => {
		// Mock fetch to throw a string
		mockFetch.mockImplementation(() => Promise.reject("String error"));

		const { result } = renderHook(() =>
			useCachedFetch("/api/string-error" as TestRoutePath),
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.data).toBeUndefined();
		expect(result.current.error).toBeDefined();
		expect(result.current.error?.message).toBe("String error");
	});

	it("should refetch when URL changes", async () => {
		const { result, rerender } = renderHook(
			({ path }) => useCachedFetch(path),
			{ initialProps: { path: "/api/test1" as TestRoutePath } },
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(mockFetch).toHaveBeenCalledWith("/api/test1");
		expect(mockFetch).toHaveBeenCalledTimes(1);

		// Change URL
		mockFetch.mockClear();
		rerender({ path: "/api/test2" as TestRoutePath });

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(mockFetch).toHaveBeenCalledWith("/api/test2");
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("should not refetch when URL stays the same", async () => {
		const { result, rerender } = renderHook(
			({ path }) => useCachedFetch(path),
			{ initialProps: { path: "/api/same" as TestRoutePath } },
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(mockFetch).toHaveBeenCalledTimes(1);

		// Rerender with same URL
		mockFetch.mockClear();
		rerender({ path: "/api/same" as TestRoutePath });

		// Wait a bit to ensure no fetch happens
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Should not refetch due to cache
		expect(mockFetch).toHaveBeenCalledTimes(0);
	});
});
