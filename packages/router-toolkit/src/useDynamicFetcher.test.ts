import { beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";
import * as ReactRouter from "react-router";

// Type for test route paths
type TestRoutePath = "/test/path" | "/api/test";

// Mock the react-router module
const mockLoad = mock(() => Promise.resolve());
const mockUseFetcher = mock(() => ({
	load: mockLoad,
	state: "idle",
	data: null,
	formData: null,
	json: null,
	text: null,
}));

const mockHref = mock((path: string, ...args: unknown[]) => {
	// Simple mock implementation that just returns the path with args stringified
	if (args.length === 0) {
		return path;
	}
	const params = args[0] as Record<string, string>;
	const queryString = new URLSearchParams(params).toString();
	return queryString ? `${path}?${queryString}` : path;
});

// Mock the react-router module
mock.module("react-router", () => ({
	...ReactRouter,
	useFetcher: mockUseFetcher,
	href: mockHref,
}));

// Import after mocking
import { useDynamicFetcher } from "./useDynamicFetcher";

describe("useDynamicFetcher", () => {
	beforeEach(() => {
		// Clear all mocks before each test
		mockLoad.mockClear();
		mockUseFetcher.mockClear();
		mockHref.mockClear();

		// Reset mock implementation
		mockUseFetcher.mockImplementation(() => ({
			load: mockLoad,
			state: "idle",
			data: null,
			formData: null,
			json: null,
			text: null,
		}));
	});

	it("should call useFetcher with the correct key based on the generated URL", () => {
		renderHook(() => useDynamicFetcher("/test/path" as TestRoutePath));

		expect(mockUseFetcher).toHaveBeenCalledWith({
			key: "fetcher-/test/path",
		});
	});

	it("should generate correct URL using href function", () => {
		renderHook(() =>
			useDynamicFetcher("/test/path" as TestRoutePath, { id: "123" }),
		);

		expect(mockHref).toHaveBeenCalledWith("/test/path", { id: "123" });
	});

	it("should call load without query params", async () => {
		const { result } = renderHook(() =>
			useDynamicFetcher("/test/path" as TestRoutePath),
		);

		await result.current.load();

		expect(mockLoad).toHaveBeenCalledWith("/test/path");
		expect(mockLoad).toHaveBeenCalledTimes(1);
	});

	it("should call load with query params", async () => {
		const { result } = renderHook(() =>
			useDynamicFetcher("/test/path" as TestRoutePath),
		);

		await result.current.load({ search: "test", filter: "active" });

		expect(mockLoad).toHaveBeenCalledWith(
			"/test/path?search=test&filter=active",
		);
		expect(mockLoad).toHaveBeenCalledTimes(1);
	});

	it("should call load multiple times with different query params", async () => {
		const { result } = renderHook(() =>
			useDynamicFetcher("/test/path" as TestRoutePath),
		);

		await result.current.load({ id: "1" });
		await result.current.load({ id: "2" });
		await result.current.load();

		expect(mockLoad).toHaveBeenCalledTimes(3);
		expect(mockLoad).toHaveBeenNthCalledWith(1, "/test/path?id=1");
		expect(mockLoad).toHaveBeenNthCalledWith(2, "/test/path?id=2");
		expect(mockLoad).toHaveBeenNthCalledWith(3, "/test/path");
	});

	it("should handle empty query params object", async () => {
		const { result } = renderHook(() =>
			useDynamicFetcher("/test/path" as TestRoutePath),
		);

		await result.current.load({});

		expect(mockLoad).toHaveBeenCalledWith("/test/path");
		expect(mockLoad).toHaveBeenCalledTimes(1);
	});

	it("should return fetcher properties", () => {
		const { result } = renderHook(() =>
			useDynamicFetcher("/test/path" as TestRoutePath),
		);

		expect(result.current).toHaveProperty("load");
		expect(result.current).toHaveProperty("state");
		expect(result.current).toHaveProperty("data");
		expect(result.current.state).toBe("idle");
	});

	it("should call href with path and args", () => {
		const args = { id: "123" };
		const { result } = renderHook(() =>
			useDynamicFetcher("/test/path" as TestRoutePath, args),
		);

		// Verify href was called with correct arguments
		expect(mockHref).toHaveBeenCalledWith("/test/path", args);

		// Verify the hook returns expected properties
		expect(result.current).toHaveProperty("load");
		expect(typeof result.current.load).toBe("function");
	});
});
