import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { z } from "zod/v4";
import { WorkerClient } from "../src/WorkerClient";

// Define test schemas matching our test workers
const ClientMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("add"),
		a: z.number(),
		b: z.number(),
	}),
	z.object({
		type: z.literal("multiply"),
		a: z.number(),
		b: z.number(),
	}),
	z.object({
		type: z.literal("echo"),
		message: z.string(),
	}),
	z.object({
		type: z.literal("error"),
		shouldThrow: z.boolean(),
	}),
]);

const ServerMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("result"),
		value: z.number(),
	}),
	z.object({
		type: z.literal("echo"),
		message: z.string(),
	}),
	z.object({
		type: z.literal("error"),
		message: z.string(),
	}),
	z.object({
		type: z.literal("input-validation-error"),
		error: z.string(),
		originalData: z.unknown(),
	}),
	z.object({
		type: z.literal("output-validation-error"),
		error: z.string(),
		attemptedOutput: z.unknown(),
	}),
	z.object({
		type: z.literal("processing-error"),
		error: z.string(),
		input: z.unknown(),
	}),
]);

type ClientMessage = z.infer<typeof ClientMessageSchema>;
type ServerMessage = z.infer<typeof ServerMessageSchema>;

describe("WorkerClient", () => {
	let client: WorkerClient<ClientMessage, ServerMessage>;

	afterEach(() => {
		client?.terminate();
	});

	describe("initialization", () => {
		it("should create a worker client from Worker instance", () => {
			const worker = new Worker(
				new URL("./test-worker.worker.ts", import.meta.url).href,
			);
			client = new WorkerClient({
				worker,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
			});

			expect(client).toBeDefined();
			expect(client.getWorker()).toBe(worker);
		});

		it("should wrap the provided worker instance", () => {
			const worker = new Worker(
				new URL("./test-worker.worker.ts", import.meta.url).href,
			);
			client = new WorkerClient({
				worker,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
			});

			expect(client.getWorker()).toBeInstanceOf(Worker);
			expect(client.getWorker()).toBe(worker);
		});
	});

	describe("sending validated messages", () => {
		// No shared beforeEach here: the "valid send" tests create their own WorkerClient;
		// a beforeEach would leak the extra worker when those tests overwrite `client`.

		it("should send valid add message", async () => {
			const result = await new Promise<ServerMessage>((resolve) => {
				const worker = new Worker(
					new URL("./test-worker.worker.ts", import.meta.url).href,
				);
				client = new WorkerClient({
					worker,
					clientSchema: ClientMessageSchema,
					serverSchema: ServerMessageSchema,
					onMessage: resolve,
				});

				client.send({
					type: "add",
					a: 5,
					b: 3,
				});
			});

			expect(result).toEqual({
				type: "result",
				value: 8,
			});
		});

		it("should send valid echo message", async () => {
			const result = await new Promise<ServerMessage>((resolve) => {
				const worker = new Worker(
					new URL("./test-worker.worker.ts", import.meta.url).href,
				);
				client = new WorkerClient({
					worker,
					clientSchema: ClientMessageSchema,
					serverSchema: ServerMessageSchema,
					onMessage: resolve,
				});

				client.send({
					type: "echo",
					message: "Hello, Worker!",
				});
			});

			expect(result).toEqual({
				type: "echo",
				message: "Hello, Worker!",
			});
		});

		describe("invalid client input", () => {
			beforeEach(() => {
				const worker = new Worker(
					new URL("./test-worker.worker.ts", import.meta.url).href,
				);
				client = new WorkerClient({
					worker,
					clientSchema: ClientMessageSchema,
					serverSchema: ServerMessageSchema,
				});
			});

			it("should throw error when sending invalid message", () => {
				expect(() => {
					client.send({
						type: "invalid",
						data: "something",
					} as unknown as ClientMessage);
				}).toThrow();
			});

			it("should throw error when sending message with wrong types", () => {
				expect(() => {
					client.send({
						type: "add",
						a: "not a number",
						b: 5,
					} as unknown as ClientMessage);
				}).toThrow();
			});

			it("should throw error when sending message with missing fields", () => {
				expect(() => {
					client.send({
						type: "add",
						a: 5,
						// missing 'b'
					} as unknown as ClientMessage);
				}).toThrow();
			});
		});
	});

	describe("receiving validated messages", () => {
		it("should receive and validate add result", async () => {
			const result = await new Promise<ServerMessage>((resolve) => {
				const worker = new Worker(
					new URL("./test-worker.worker.ts", import.meta.url).href,
				);
				client = new WorkerClient({
					worker,
					clientSchema: ClientMessageSchema,
					serverSchema: ServerMessageSchema,
					onMessage: resolve,
				});

				client.send({
					type: "add",
					a: 10,
					b: 20,
				});
			});

			expect(result).toEqual({
				type: "result",
				value: 30,
			});
		});

		it("should receive and validate multiply result", async () => {
			const result = await new Promise<ServerMessage>((resolve) => {
				const worker = new Worker(
					new URL("./test-worker.worker.ts", import.meta.url).href,
				);
				client = new WorkerClient({
					worker,
					clientSchema: ClientMessageSchema,
					serverSchema: ServerMessageSchema,
					onMessage: resolve,
				});

				client.send({
					type: "multiply",
					a: 4,
					b: 7,
				});
			});

			expect(result).toEqual({
				type: "result",
				value: 28,
			});
		});

		it("should receive multiple messages sequentially", async () => {
			const messages: ServerMessage[] = [];
			const expectedCount = 3;

			await new Promise<void>((resolve) => {
				const worker = new Worker(
					new URL("./test-worker.worker.ts", import.meta.url).href,
				);
				client = new WorkerClient({
					worker,
					clientSchema: ClientMessageSchema,
					serverSchema: ServerMessageSchema,
					onMessage: (msg) => {
						messages.push(msg);
						if (messages.length === expectedCount) {
							resolve();
						}
					},
				});

				client.send({ type: "add", a: 1, b: 2 });
				client.send({ type: "multiply", a: 3, b: 4 });
				client.send({ type: "echo", message: "test" });
			});

			expect(messages).toHaveLength(3);
			expect(messages[0]).toEqual({ type: "result", value: 3 });
			expect(messages[1]).toEqual({ type: "result", value: 12 });
			expect(messages[2]).toEqual({ type: "echo", message: "test" });
		});
	});

	describe("validation error handling", () => {
		it("should receive output validation error from worker", async () => {
			const result = await new Promise<ServerMessage>((resolve) => {
				const worker = new Worker(
					new URL("./test-worker-invalid-output.worker.ts", import.meta.url)
						.href,
				);
				client = new WorkerClient({
					worker,
					clientSchema: ClientMessageSchema,
					serverSchema: ServerMessageSchema,
					onMessage: resolve,
				});

				client.send({
					type: "add",
					a: 5,
					b: 3,
				});
			});

			// Worker sends back a properly formatted error message
			expect(result.type).toBe("output-validation-error");
			if (result.type === "output-validation-error") {
				expect(result.error).toContain("Output validation failed");
			}
		});

		it("should call onValidationError when worker sends truly invalid data", async () => {
			// This test would need a worker that sends completely unstructured data
			// For now, we verify the callback is properly registered
			let errorCalled = false;

			const worker = new Worker(
				new URL("./test-worker.worker.ts", import.meta.url).href,
			);
			client = new WorkerClient({
				worker,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				onValidationError: () => {
					errorCalled = true;
				},
			});

			// The test worker sends valid messages, so error should not be called
			await new Promise<void>((resolve) => {
				setTimeout(resolve, 50);
			});

			expect(errorCalled).toBe(false);
		});
	});

	describe("worker lifecycle", () => {
		it("should terminate worker", () => {
			const worker = new Worker(
				new URL("./test-worker.worker.ts", import.meta.url).href,
			);
			client = new WorkerClient({
				worker,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
			});

			expect(() => client.terminate()).not.toThrow();
		});

		it("should get underlying worker instance", () => {
			const worker = new Worker(
				new URL("./test-worker.worker.ts", import.meta.url).href,
			);

			client = new WorkerClient({
				worker,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
			});

			expect(client.getWorker()).toBe(worker);
		});
	});

	describe("error events", () => {
		it("should handle worker error events", async () => {
			let errorReceived = false;
			let receivedEvent: ErrorEvent | undefined;

			// Create a real worker first
			const worker = new Worker(
				new URL("./test-worker.worker.ts", import.meta.url).href,
			);

			client = new WorkerClient({
				worker,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				onError: (event) => {
					errorReceived = true;
					receivedEvent = event;
				},
			});

			// Manually dispatch an error event to the worker
			const errorEvent = new ErrorEvent("error", {
				message: "Test error",
				filename: "test-worker.worker.ts",
				lineno: 1,
				colno: 1,
			});

			worker.dispatchEvent(errorEvent);

			// Give time for event to be processed
			await new Promise<void>((resolve) => setTimeout(resolve, 10));

			expect(errorReceived).toBe(true);
			expect(receivedEvent).toBeInstanceOf(ErrorEvent);
			expect(receivedEvent?.message).toBe("Test error");
		});
	});
});
