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
		renderHook(() => useDynamicSubmitter("/test/path"));

		expect(mockUseFetcher).toHaveBeenCalledWith({
			key: "submitter-/test/path",
		});
	});

	it("should generate correct URL using href function", () => {
		renderHook(() => useDynamicSubmitter("/test/path", { id: "123" }));

		expect(mockHref).toHaveBeenCalledWith("/test/path", { id: "123" });
	});

	it("should call submit with correct action and encType", async () => {
		const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));
		const formData = {
			name: "test",
			email: "test@example.com",
		} as const;
		await result.current.submit(formData, { method: "POST" });

		expect(mockSubmit).toHaveBeenCalledWith(formData, {
			method: "POST",
			action: "/api/submit",
			encType: "multipart/form-data",
		});
		expect(mockSubmit).toHaveBeenCalledTimes(1);
	});

	it("should handle multiple submit calls with different data", async () => {
		const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));
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
		const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));
		const formData = { name: "test" } as SubmitTarget;
		await result.current.submit(formData, {
			method: "POST",
			fetcherKey: "custom-key",
		});

		expect(mockSubmit).toHaveBeenCalledWith(formData, {
			method: "POST",
			fetcherKey: "custom-key",
			action: "/api/submit",
			encType: "multipart/form-data",
		});
	});

	it("should return Form component with action set", () => {
		const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));

		expect(result.current.Form).toBeDefined();
		expect(typeof result.current.Form).toBe("function");

		// Test that Form is a component
		const FormComponent = result.current.Form;
		const formElement = FormComponent({ method: "POST", children: null });

		expect(formElement).toBeDefined();
	});

	it("should default Form method to POST when not specified", () => {
		const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));

		const FormComponent = result.current.Form;
		// Call without method - should default to POST
		const formElement = FormComponent({ children: null });

		expect(formElement).toBeDefined();
		// Check the element's props for the default method
		expect(formElement.props).toMatchObject({
			action: "/api/submit",
			method: "POST",
		});
	});

	it("should allow overriding Form method", () => {
		const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));

		const FormComponent = result.current.Form;
		const formElement = FormComponent({ method: "PUT", children: null });

		expect(formElement.props).toMatchObject({
			action: "/api/submit",
			method: "PUT",
		});
	});

	it("should return fetcher properties", () => {
		const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));

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
			useDynamicSubmitter("/test/path", ...args),
		);

		// Verify href was called with correct arguments
		expect(mockHref).toHaveBeenCalledWith("/test/path", args[0]);

		// Verify the hook returns expected properties
		expect(result.current).toHaveProperty("submit");
		expect(typeof result.current.submit).toBe("function");
	});

	it("should handle different HTTP methods", async () => {
		const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));
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

	describe("submitJson", () => {
		it("should call submit with correct action and application/json encType", async () => {
			const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));
			const jsonData = {
				email: "user@example.com",
				password: "secret123",
				rememberMe: true,
			};

			await result.current.submitJson(jsonData, { method: "POST" });

			expect(mockSubmit).toHaveBeenCalledWith(jsonData, {
				method: "POST",
				action: "/api/submit",
				encType: "application/json",
			});
			expect(mockSubmit).toHaveBeenCalledTimes(1);
		});

		it("should default to POST method when no options provided", async () => {
			const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));
			const jsonData = {
				email: "user@example.com",
				password: "secret123",
			};

			// Call without options - should default to POST
			await result.current.submitJson(jsonData);

			expect(mockSubmit).toHaveBeenCalledWith(jsonData, {
				method: "POST",
				action: "/api/submit",
				encType: "application/json",
			});
		});

		it("should default to POST method when options provided without method", async () => {
			const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));
			const jsonData = { name: "test" };

			// Call with options but no method - should default to POST
			await result.current.submitJson(jsonData, {
				fetcherKey: "custom-key",
			});

			expect(mockSubmit).toHaveBeenCalledWith(jsonData, {
				method: "POST",
				fetcherKey: "custom-key",
				action: "/api/submit",
				encType: "application/json",
			});
		});

		it("should handle plain objects without SubmitTarget", async () => {
			const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));

			// Plain object - no casting to SubmitTarget needed
			const plainObject = {
				title: "My Post",
				content: "Post content here",
				published: false,
			};

			await result.current.submitJson(plainObject, { method: "POST" });

			expect(mockSubmit).toHaveBeenCalledWith(plainObject, {
				method: "POST",
				action: "/api/submit",
				encType: "application/json",
			});
		});

		it("should handle multiple submitJson calls with different data", async () => {
			const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));

			const data1 = { name: "test1", value: 1 };
			const data2 = { name: "test2", value: 2 };

			await result.current.submitJson(data1, { method: "POST" });
			await result.current.submitJson(data2, { method: "PUT" });

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
			const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));
			const jsonData = { name: "test" };

			await result.current.submitJson(jsonData, {
				method: "POST",
				fetcherKey: "custom-key",
			});

			expect(mockSubmit).toHaveBeenCalledWith(jsonData, {
				method: "POST",
				fetcherKey: "custom-key",
				action: "/api/submit",
				encType: "application/json",
			});
		});

		it("should handle different HTTP methods with submitJson", async () => {
			const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));
			const jsonData = { name: "test" };

			// Test POST
			await result.current.submitJson(jsonData, { method: "POST" });
			expect(mockSubmit).toHaveBeenLastCalledWith(
				jsonData,
				expect.objectContaining({
					method: "POST",
					encType: "application/json",
				}),
			);

			// Test PUT
			await result.current.submitJson(jsonData, { method: "PUT" });
			expect(mockSubmit).toHaveBeenLastCalledWith(
				jsonData,
				expect.objectContaining({ method: "PUT", encType: "application/json" }),
			);

			// Test PATCH
			await result.current.submitJson(jsonData, { method: "PATCH" });
			expect(mockSubmit).toHaveBeenLastCalledWith(
				jsonData,
				expect.objectContaining({
					method: "PATCH",
					encType: "application/json",
				}),
			);

			// Test DELETE
			await result.current.submitJson(jsonData, { method: "DELETE" });
			expect(mockSubmit).toHaveBeenLastCalledWith(
				jsonData,
				expect.objectContaining({
					method: "DELETE",
					encType: "application/json",
				}),
			);

			expect(mockSubmit).toHaveBeenCalledTimes(4);
		});

		it("should use different encType than submit", async () => {
			const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));
			const data = { name: "test" };

			// submit uses multipart/form-data
			await result.current.submit(data, { method: "POST" });
			expect(mockSubmit).toHaveBeenLastCalledWith(
				data,
				expect.objectContaining({ encType: "multipart/form-data" }),
			);

			// submitJson uses application/json
			await result.current.submitJson(data, { method: "POST" });
			expect(mockSubmit).toHaveBeenLastCalledWith(
				data,
				expect.objectContaining({ encType: "application/json" }),
			);
		});
	});

	it("should return submitJson in fetcher properties", () => {
		const { result } = renderHook(() => useDynamicSubmitter("/api/submit"));

		expect(result.current).toHaveProperty("submit");
		expect(result.current).toHaveProperty("submitJson");
		expect(result.current).toHaveProperty("Form");
		expect(result.current).toHaveProperty("state");
		expect(result.current).toHaveProperty("data");
		expect(typeof result.current.submitJson).toBe("function");
	});
});
