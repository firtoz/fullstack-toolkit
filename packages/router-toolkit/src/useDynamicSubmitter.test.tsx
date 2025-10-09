import { beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";
import React from "react";
import * as ReactRouter from "react-router";

// Mock the react-router module
const mockSubmit = mock(() => Promise.resolve());
const mockForm = mock((props: React.PropsWithChildren<{ action?: string }>) => {
	return React.createElement("form", props);
});

const mockUseFetcher = mock(() => ({
	submit: mockSubmit,
	Form: mockForm,
	state: "idle",
	data: null,
	formData: null,
	json: null,
	text: null,
}));

const mockHref = mock((path: string, ...args: unknown[]) => {
	// Simple mock implementation
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

// Type for test route paths
type TestRoutePath = "/test/path" | "/api/submit";

import type { SubmitTarget } from "react-router";
import type { $ZodAnyParams } from "zod/v4/core";
import { useDynamicSubmitter } from "./useDynamicSubmitter";

describe("useDynamicSubmitter", () => {
	beforeEach(() => {
		// Clear all mocks before each test
		mockSubmit.mockClear();
		mockUseFetcher.mockClear();
		mockHref.mockClear();
		mockForm.mockClear();

		// Reset mock implementation
		mockUseFetcher.mockImplementation(() => ({
			submit: mockSubmit,
			Form: mockForm,
			state: "idle",
			data: null,
			formData: null,
			json: null,
			text: null,
		}));
	});

	it("should call useFetcher with the correct key based on the generated URL", () => {
		renderHook(() => useDynamicSubmitter("/test/path" as TestRoutePath));

		expect(mockUseFetcher).toHaveBeenCalledWith({
			key: "submitter-/test/path",
		});
	});

	it("should generate correct URL using href function", () => {
		renderHook(() =>
			useDynamicSubmitter("/test/path" as TestRoutePath, { id: "123" }),
		);

		expect(mockHref).toHaveBeenCalledWith("/test/path", { id: "123" });
	});

	it("should call submit with correct action and encType", async () => {
		const { result } = renderHook(() =>
			useDynamicSubmitter("/api/submit" as TestRoutePath),
		);
		const formData = {
			name: "test",
			email: "test@example.com",
		} as SubmitTarget;
		await result.current.submit(formData, { method: "POST" });

		expect(mockSubmit).toHaveBeenCalledWith(formData, {
			method: "POST",
			action: "/api/submit",
			encType: "multipart/form-data",
		});
		expect(mockSubmit).toHaveBeenCalledTimes(1);
	});

	it("should handle multiple submit calls with different data", async () => {
		const { result } = renderHook(() =>
			useDynamicSubmitter("/api/submit" as TestRoutePath),
		);
		const formData1 = { name: "test1" } as SubmitTarget;
		const formData2 = { name: "test2" } as SubmitTarget;

		await result.current.submit(formData1, { method: "POST" });
		await result.current.submit(formData2, { method: "PUT" });

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
		const { result } = renderHook(() =>
			useDynamicSubmitter("/api/submit" as TestRoutePath),
		);
		const formData = { name: "test" } as SubmitTarget;
		await result.current.submit(formData, {
			method: "POST",
			fetcherKey: "custom-key",
		} as Parameters<typeof result.current.submit>[1]);

		expect(mockSubmit).toHaveBeenCalledWith(formData, {
			method: "POST",
			fetcherKey: "custom-key",
			action: "/api/submit",
			encType: "multipart/form-data",
		});
	});

	it("should return Form component with action set", () => {
		const { result } = renderHook(() =>
			useDynamicSubmitter("/api/submit" as TestRoutePath),
		);

		expect(result.current.Form).toBeDefined();
		expect(typeof result.current.Form).toBe("function");

		// Test that Form is a component
		const FormComponent = result.current.Form;
		const formElement = FormComponent({ method: "POST", children: null });

		expect(formElement).toBeDefined();
	});

	it("should return fetcher properties", () => {
		const { result } = renderHook(() =>
			useDynamicSubmitter("/api/submit" as TestRoutePath),
		);

		expect(result.current).toHaveProperty("submit");
		expect(result.current).toHaveProperty("Form");
		expect(result.current).toHaveProperty("state");
		expect(result.current).toHaveProperty("data");
		expect(result.current.state).toBe("idle");

		// Should not have load property (since useDynamicSubmitter omits it)
		expect(result.current).not.toHaveProperty("load");
	});

	it("should call href with path and args", () => {
		const args = [{ id: "123" }] as [$ZodAnyParams];

		const { result } = renderHook(() =>
			useDynamicSubmitter("/test/path" as TestRoutePath, ...args),
		);

		// Verify href was called with correct arguments
		expect(mockHref).toHaveBeenCalledWith("/test/path", args[0]);

		// Verify the hook returns expected properties
		expect(result.current).toHaveProperty("submit");
		expect(typeof result.current.submit).toBe("function");
	});

	it("should handle different HTTP methods", async () => {
		const { result } = renderHook(() =>
			useDynamicSubmitter("/api/submit" as TestRoutePath),
		);
		const formData = { name: "test" } as SubmitTarget;

		// Test POST
		await result.current.submit(formData, { method: "POST" });
		expect(mockSubmit).toHaveBeenLastCalledWith(
			formData,
			expect.objectContaining({ method: "POST" }),
		);

		// Test PUT
		await result.current.submit(formData, { method: "PUT" });
		expect(mockSubmit).toHaveBeenLastCalledWith(
			formData,
			expect.objectContaining({ method: "PUT" }),
		);

		// Test PATCH
		await result.current.submit(formData, { method: "PATCH" });
		expect(mockSubmit).toHaveBeenLastCalledWith(
			formData,
			expect.objectContaining({ method: "PATCH" }),
		);

		// Test DELETE
		await result.current.submit(formData, { method: "DELETE" });
		expect(mockSubmit).toHaveBeenLastCalledWith(
			formData,
			expect.objectContaining({ method: "DELETE" }),
		);

		expect(mockSubmit).toHaveBeenCalledTimes(4);
	});
});
