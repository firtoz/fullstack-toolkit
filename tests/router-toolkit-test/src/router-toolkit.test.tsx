// Testing library imports removed as DOM tests are not needed for formAction utility

import { describe, expect, it, mock } from "bun:test";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";

// Test imports
describe("Router Toolkit Imports", () => {
	it("should be able to import router-toolkit hooks", async () => {
		const { useDynamicFetcher, useDynamicSubmitter } = await import(
			"@firtoz/router-toolkit"
		);

		expect(useDynamicFetcher).toBeDefined();
		expect(useDynamicSubmitter).toBeDefined();
		expect(typeof useDynamicFetcher).toBe("function");
		expect(typeof useDynamicSubmitter).toBe("function");
	});

	it("should be able to import maybe-error utilities", async () => {
		const { success, fail } = await import("@firtoz/maybe-error");

		expect(success).toBeDefined();
		expect(fail).toBeDefined();
		expect(typeof success).toBe("function");
		expect(typeof fail).toBe("function");

		// Test basic functionality
		const successResult = success(42);
		expect(successResult.success).toBe(true);
		expect(successResult.result).toBe(42);

		const errorResult = fail("test error");
		expect(errorResult.success).toBe(false);
		expect(errorResult.error).toBe("test error");
	});

	it("should be able to import formAction utility", async () => {
		const { formAction } = await import("@firtoz/router-toolkit");

		expect(formAction).toBeDefined();
		expect(typeof formAction).toBe("function");
	});
});

// Test formAction utility
describe("formAction", () => {
	const createMockRequest = (formData: Record<string, string | File>) => {
		const mockFormData = new FormData();
		for (const [key, value] of Object.entries(formData)) {
			mockFormData.append(key, value);
		}

		return {
			formData: mock(() => Promise.resolve(mockFormData)),
		} as unknown as Request;
	};

	const createMockActionArgs = (
		formData: Record<string, string | File>,
	): ActionFunctionArgs => ({
		request: createMockRequest(formData),
		params: {},
		context: {},
	});

	it("should successfully validate and process form data", async () => {
		const { formAction } = await import("@firtoz/router-toolkit");
		const { success } = await import("@firtoz/maybe-error");

		const schema = z.object({
			email: z.string().email(),
			password: z.string().min(8),
		});

		const mockHandler = mock(() => Promise.resolve(success({ userId: 123 })));

		const action = formAction({
			schema,
			handler: mockHandler,
		});

		const args = createMockActionArgs({
			email: "test@example.com",
			password: "password123",
		});

		const result = await action(args);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.result).toEqual({ userId: 123 });
		}
		expect(mockHandler).toHaveBeenCalledWith(args, {
			email: "test@example.com",
			password: "password123",
		});
	});

	it("should return validation error for invalid form data", async () => {
		const { formAction } = await import("@firtoz/router-toolkit");
		const { success } = await import("@firtoz/maybe-error");

		const schema = z.object({
			email: z.string().email(),
			password: z.string().min(8),
		});

		const mockHandler = mock(() => Promise.resolve(success({})));

		const action = formAction({
			schema,
			handler: mockHandler,
		});

		const args = createMockActionArgs({
			email: "invalid-email",
			password: "short",
		});

		const result = await action(args);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.type).toBe("validation");
			if (result.error.type === "validation") {
				expect(result.error.error).toBeDefined();
			}
		}
		expect(mockHandler).not.toHaveBeenCalled();
	});

	it("should return handler error when handler fails", async () => {
		const { formAction } = await import("@firtoz/router-toolkit");
		const { fail } = await import("@firtoz/maybe-error");

		const schema = z.object({
			email: z.string().email(),
			password: z.string().min(8),
		});

		const mockHandler = mock(() =>
			Promise.resolve(fail("Authentication failed")),
		);

		const action = formAction({
			schema,
			handler: mockHandler,
		});

		const args = createMockActionArgs({
			email: "test@example.com",
			password: "password123",
		});

		const result = await action(args);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.type).toBe("handler");
			if (result.error.type === "handler") {
				expect(result.error.error).toBe("Authentication failed");
			}
		}
		expect(mockHandler).toHaveBeenCalledWith(args, {
			email: "test@example.com",
			password: "password123",
		});
	});

	it("should re-throw Response objects (redirects)", async () => {
		const { formAction } = await import("@firtoz/router-toolkit");

		const schema = z.object({
			email: z.string().email(),
		});

		const mockResponse = new Response(null, {
			status: 302,
			headers: { Location: "/dashboard" },
		});
		const mockHandler = mock(() => Promise.reject(mockResponse));

		const action = formAction({
			schema,
			handler: mockHandler,
		});

		const args = createMockActionArgs({
			email: "test@example.com",
		});

		await expect(action(args)).rejects.toBe(mockResponse);
	});

	it("should return unknown error for unexpected exceptions", async () => {
		const { formAction } = await import("@firtoz/router-toolkit");

		const schema = z.object({
			email: z.string().email(),
		});

		const mockHandler = mock(() =>
			Promise.reject(new Error("Unexpected error")),
		);

		const action = formAction({
			schema,
			handler: mockHandler,
		});

		const args = createMockActionArgs({
			email: "test@example.com",
		});

		const originalConsoleError = console.error;
		const consoleErrorMock = mock(() => {});
		console.error = consoleErrorMock;

		const result = await action(args);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.type).toBe("unknown");
		}
		expect(consoleErrorMock).toHaveBeenCalled();

		console.error = originalConsoleError;
	});

	it("should handle complex schema with nested validation", async () => {
		const { formAction } = await import("@firtoz/router-toolkit");
		const { success } = await import("@firtoz/maybe-error");

		const schema = z.object({
			user: z.object({
				name: z.string().min(2),
				age: z.coerce.number().min(18),
			}),
			terms: z.literal("on"),
		});

		const mockHandler = mock(() => Promise.resolve(success({ created: true })));

		const action = formAction({
			schema,
			handler: mockHandler,
		});

		const args = createMockActionArgs({
			"user.name": "John Doe",
			"user.age": "25",
			terms: "on",
		});

		const result = await action(args);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.result).toEqual({ created: true });
		}
		expect(mockHandler).toHaveBeenCalledWith(args, {
			user: {
				name: "John Doe",
				age: 25,
			},
			terms: "on",
		});
	});

	it("should work with void result handlers", async () => {
		const { formAction } = await import("@firtoz/router-toolkit");
		const { success } = await import("@firtoz/maybe-error");

		const schema = z.object({
			action: z.string(),
		});

		const mockHandler = mock(() => Promise.resolve(success()));

		const action = formAction({
			schema,
			handler: mockHandler,
		});

		const args = createMockActionArgs({
			action: "delete",
		});

		const result = await action(args);

		expect(result.success).toBe(true);
		expect(mockHandler).toHaveBeenCalledWith(args, {
			action: "delete",
		});
	});

	it("should handle file uploads", async () => {
		const { formAction } = await import("@firtoz/router-toolkit");
		const { success } = await import("@firtoz/maybe-error");

		const schema = z.object({
			title: z.string(),
			file: z.instanceof(File),
		});

		const mockHandler = mock(() =>
			Promise.resolve(success({ uploaded: true })),
		);

		const action = formAction({
			schema,
			handler: mockHandler,
		});

		const mockFile = new File(["content"], "test.txt", { type: "text/plain" });
		const args = createMockActionArgs({
			title: "Test Upload",
			file: mockFile,
		});

		const result = await action(args);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.result).toEqual({ uploaded: true });
		}
		expect(mockHandler).toHaveBeenCalledWith(args, {
			title: "Test Upload",
			file: mockFile,
		});
	});
});

// Note: React Router DOM tests are skipped in this environment
// as they require a proper browser DOM setup
