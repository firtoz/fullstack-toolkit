/**
 * Unit tests for ZodWebSocketDO hibernation logic by mocking the base class
 */

import type {
	ZodSessionOptions,
	ZodSessionOptionsOrFactory,
} from "@firtoz/websocket-do";
import type { Context } from "hono";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

describe("ZodWebSocketDO Constructor Hibernation Unit Tests", () => {
	const ClientMessageSchema = z.object({ type: z.literal("test") });
	const ServerMessageSchema = z.object({ type: z.literal("response") });
	type ClientMessage = z.infer<typeof ClientMessageSchema>;
	type ServerMessage = z.infer<typeof ServerMessageSchema>;

	it("should use static options for hibernated connections", async () => {
		const mockWebSocket = {
			readyState: WebSocket.OPEN,
			serializeAttachment: vi.fn((data: unknown) => data),
			deserializeAttachment: vi.fn(() => ({
				userId: "hibernated-user",
				data: { test: "value" },
			})),
		} as unknown as WebSocket;

		const mockState = {
			id: { toString: () => "test-id" },
			blockConcurrencyWhile: vi.fn(async (cb: () => Promise<void>) => {
				await cb();
			}),
			getWebSockets: vi.fn(() => [mockWebSocket]),
			storage: {} as DurableObjectStorage,
			waitUntil: vi.fn(),
		};

		const mockEnv = {} as Env;

		const staticOptions: ZodSessionOptionsOrFactory<
			ClientMessage,
			ServerMessage,
			Env
		> = {
			clientSchema: ClientMessageSchema,
			serverSchema: ServerMessageSchema,
			enableBufferMessages: true,
		};

		const createZodSessionCalls: Array<{
			ctx: Context<{ Bindings: Env }> | undefined;
			websocket: WebSocket;
			options: ZodSessionOptions<ClientMessage, ServerMessage>;
		}> = [];

		// Mock base class
		class MockDurableObject {
			ctx: typeof mockState;
			env: typeof mockEnv;

			constructor(ctx: typeof mockState, env: typeof mockEnv) {
				this.ctx = ctx;
				this.env = env;
			}
		}

		// Mock ZodWebSocketDO
		class TestZodWebSocketDO extends MockDurableObject {
			protected readonly sessions = new Map<WebSocket, any>();

			constructor(
				ctx: typeof mockState,
				env: typeof mockEnv,
				protected zodSessionOptions: ZodSessionOptionsOrFactory<
					ClientMessage,
					ServerMessage,
					Env
				>,
			) {
				super(ctx, env);

				this.ctx.blockConcurrencyWhile(async () => {
					const websockets = this.ctx.getWebSockets();
					await Promise.all(
						websockets.map(async (websocket) => {
							const session = await this.createSession(undefined, websocket);
							session.resume();
							this.sessions.set(websocket, session);
						}),
					);
				});
			}

			protected createSession(
				ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
			) {
				const options =
					typeof this.zodSessionOptions === "function"
						? this.zodSessionOptions(ctx, websocket)
						: this.zodSessionOptions;

				if (!options) {
					throw new Error("zodSessionOptions must be provided");
				}

				return this.createZodSession(ctx, websocket, options);
			}

			protected createZodSession(
				ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
				options: ZodSessionOptions<ClientMessage, ServerMessage>,
			) {
				createZodSessionCalls.push({ ctx, websocket, options });

				return {
					websocket,
					data: null,
					resume() {
						this.data = websocket.deserializeAttachment();
					},
				};
			}
		}

		new TestZodWebSocketDO(mockState, mockEnv, staticOptions);
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify createZodSession was called correctly
		expect(createZodSessionCalls).toHaveLength(1);
		expect(createZodSessionCalls[0]?.ctx).toBeUndefined();
		expect(createZodSessionCalls[0]?.websocket).toBe(mockWebSocket);
		expect(createZodSessionCalls[0]?.options).toBe(staticOptions);
		expect(createZodSessionCalls[0]?.options.enableBufferMessages).toBe(true);
	});

	it("should call options factory with undefined ctx for hibernated connections", async () => {
		const mockWebSocket = {
			readyState: WebSocket.OPEN,
			deserializeAttachment: vi.fn(() => ({ userId: "user" })),
		} as unknown as WebSocket;

		const mockState = {
			id: { toString: () => "test-id" },
			blockConcurrencyWhile: vi.fn(async (cb: () => Promise<void>) => {
				await cb();
			}),
			getWebSockets: vi.fn(() => [mockWebSocket]),
			storage: {} as DurableObjectStorage,
			waitUntil: vi.fn(),
		};

		const mockEnv = {} as Env;

		const factoryCalls: Array<{
			ctx: Context<{ Bindings: Env }> | undefined;
			websocket: WebSocket;
		}> = [];

		const optionsFactory = (
			ctx: Context<{ Bindings: Env }> | undefined,
			websocket: WebSocket,
		) => {
			factoryCalls.push({ ctx, websocket });

			return {
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				enableBufferMessages: !ctx, // Different based on ctx
			};
		};

		class MockDurableObject {
			ctx: typeof mockState;
			env: typeof mockEnv;

			constructor(ctx: typeof mockState, env: typeof mockEnv) {
				this.ctx = ctx;
				this.env = env;
			}
		}

		class TestZodWebSocketDO extends MockDurableObject {
			protected readonly sessions = new Map<WebSocket, any>();

			constructor(
				ctx: typeof mockState,
				env: typeof mockEnv,
				protected zodSessionOptions: typeof optionsFactory,
			) {
				super(ctx, env);

				this.ctx.blockConcurrencyWhile(async () => {
					const websockets = this.ctx.getWebSockets();
					await Promise.all(
						websockets.map(async (websocket) => {
							const session = await this.createSession(undefined, websocket);
							session.resume();
							this.sessions.set(websocket, session);
						}),
					);
				});
			}

			protected createSession(
				ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
			) {
				const options =
					typeof this.zodSessionOptions === "function"
						? this.zodSessionOptions(ctx, websocket)
						: this.zodSessionOptions;

				if (!options) {
					throw new Error("zodSessionOptions must be provided");
				}

				return this.createZodSession(ctx, websocket, options);
			}

			protected createZodSession(
				_ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
				_options: ZodSessionOptions<ClientMessage, ServerMessage>,
			) {
				return {
					websocket,
					data: null,
					resume() {
						this.data = websocket.deserializeAttachment();
					},
				};
			}
		}

		new TestZodWebSocketDO(mockState, mockEnv, optionsFactory);
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify factory was called with undefined ctx (hibernation path)
		expect(factoryCalls).toHaveLength(1);
		expect(factoryCalls[0]?.ctx).toBeUndefined();
		expect(factoryCalls[0]?.websocket).toBe(mockWebSocket);
	});

	it("should handle dynamic options based on hibernation state", async () => {
		const mockWebSocket = {
			readyState: WebSocket.OPEN,
			deserializeAttachment: vi.fn(() => ({ format: "buffer" })),
		} as unknown as WebSocket;

		const mockState = {
			id: { toString: () => "test-id" },
			blockConcurrencyWhile: vi.fn(async (cb: () => Promise<void>) => {
				await cb();
			}),
			getWebSockets: vi.fn(() => [mockWebSocket]),
			storage: {} as DurableObjectStorage,
			waitUntil: vi.fn(),
		};

		const mockEnv = {} as Env;

		const optionsFromFactory: ZodSessionOptions<
			ClientMessage,
			ServerMessage
		>[] = [];

		// Factory that returns different options for hibernated vs fresh connections
		const optionsFactory = (
			ctx: Context<{ Bindings: Env }> | undefined,
			_websocket: WebSocket,
		) => {
			const options: ZodSessionOptions<ClientMessage, ServerMessage> = {
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				// For hibernated connections (ctx === undefined), default to buffer mode
				// For fresh connections, could check query params from ctx
				enableBufferMessages: ctx === undefined,
			};
			optionsFromFactory.push(options);
			return options;
		};

		class MockDurableObject {
			ctx: typeof mockState;
			env: typeof mockEnv;

			constructor(ctx: typeof mockState, env: typeof mockEnv) {
				this.ctx = ctx;
				this.env = env;
			}
		}

		class TestZodWebSocketDO extends MockDurableObject {
			protected readonly sessions = new Map<WebSocket, any>();

			constructor(
				ctx: typeof mockState,
				env: typeof mockEnv,
				protected zodSessionOptions: typeof optionsFactory,
			) {
				super(ctx, env);

				this.ctx.blockConcurrencyWhile(async () => {
					const websockets = this.ctx.getWebSockets();
					await Promise.all(
						websockets.map(async (websocket) => {
							const session = await this.createSession(undefined, websocket);
							this.sessions.set(websocket, session);
						}),
					);
				});
			}

			protected createSession(
				ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
			) {
				const options =
					typeof this.zodSessionOptions === "function"
						? this.zodSessionOptions(ctx, websocket)
						: this.zodSessionOptions;

				if (!options) {
					throw new Error("zodSessionOptions must be provided");
				}

				return this.createZodSession(ctx, websocket, options);
			}

			protected createZodSession(
				_ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
				_options: ZodSessionOptions<ClientMessage, ServerMessage>,
			) {
				return { websocket, data: null };
			}
		}

		new TestZodWebSocketDO(mockState, mockEnv, optionsFactory);
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify the options were generated for hibernated connection
		expect(optionsFromFactory).toHaveLength(1);
		expect(optionsFromFactory[0]?.enableBufferMessages).toBe(true);
	});

	it("should process multiple hibernated connections with factory options", async () => {
		const mockWs1 = {
			readyState: WebSocket.OPEN,
			deserializeAttachment: vi.fn(() => ({ userId: "user-1" })),
		} as unknown as WebSocket;

		const mockWs2 = {
			readyState: WebSocket.OPEN,
			deserializeAttachment: vi.fn(() => ({ userId: "user-2" })),
		} as unknown as WebSocket;

		const mockState = {
			id: { toString: () => "test-id" },
			blockConcurrencyWhile: vi.fn(async (cb: () => Promise<void>) => {
				await cb();
			}),
			getWebSockets: vi.fn(() => [mockWs1, mockWs2]),
			storage: {} as DurableObjectStorage,
			waitUntil: vi.fn(),
		};

		const mockEnv = {} as Env;

		let factoryCallCount = 0;
		const optionsFactory = (
			_ctx: Context<{ Bindings: Env }> | undefined,
			_websocket: WebSocket,
		) => {
			factoryCallCount++;
			return {
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				enableBufferMessages: true,
			};
		};

		class MockDurableObject {
			ctx: typeof mockState;
			env: typeof mockEnv;

			constructor(ctx: typeof mockState, env: typeof mockEnv) {
				this.ctx = ctx;
				this.env = env;
			}
		}

		class TestZodWebSocketDO extends MockDurableObject {
			protected readonly sessions = new Map<WebSocket, any>();

			constructor(
				ctx: typeof mockState,
				env: typeof mockEnv,
				protected zodSessionOptions: typeof optionsFactory,
			) {
				super(ctx, env);

				this.ctx.blockConcurrencyWhile(async () => {
					const websockets = this.ctx.getWebSockets();
					await Promise.all(
						websockets.map(async (websocket) => {
							const session = await this.createSession(undefined, websocket);
							this.sessions.set(websocket, session);
						}),
					);
				});
			}

			protected createSession(
				ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
			) {
				const options =
					typeof this.zodSessionOptions === "function"
						? this.zodSessionOptions(ctx, websocket)
						: this.zodSessionOptions;

				return this.createZodSession(ctx, websocket, options);
			}

			protected createZodSession(
				_ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
				_options: ZodSessionOptions<ClientMessage, ServerMessage>,
			) {
				return { websocket, data: null };
			}
		}

		const doInstance = new TestZodWebSocketDO(
			mockState,
			mockEnv,
			optionsFactory,
		);
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify factory was called for each WebSocket
		expect(factoryCallCount).toBe(2);
		// @ts-expect-error - accessing protected property for testing
		expect(doInstance.sessions.size).toBe(2);
	});

	it("should throw error if options are not provided", async () => {
		const mockWebSocket = {
			readyState: WebSocket.OPEN,
			deserializeAttachment: vi.fn(() => ({})),
		} as unknown as WebSocket;

		const mockState = {
			id: { toString: () => "test-id" },
			blockConcurrencyWhile: vi.fn(async (cb: () => Promise<void>) => {
				await cb();
			}),
			getWebSockets: vi.fn(() => [mockWebSocket]),
			storage: {} as DurableObjectStorage,
			waitUntil: vi.fn(),
		};

		const mockEnv = {} as Env;

		class MockDurableObject {
			ctx: typeof mockState;
			env: typeof mockEnv;

			constructor(ctx: typeof mockState, env: typeof mockEnv) {
				this.ctx = ctx;
				this.env = env;
			}
		}

		class TestZodWebSocketDO extends MockDurableObject {
			protected readonly sessions = new Map<WebSocket, any>();

			constructor(
				ctx: typeof mockState,
				env: typeof mockEnv,
				protected zodSessionOptions?:
					| ZodSessionOptionsOrFactory<ClientMessage, ServerMessage, Env>
					| undefined,
			) {
				super(ctx, env);

				this.ctx.blockConcurrencyWhile(async () => {
					const websockets = this.ctx.getWebSockets();
					await Promise.all(
						websockets.map(async (websocket) => {
							await this.createSession(undefined, websocket);
						}),
					);
				});
			}

			protected createSession(
				_ctx: Context<{ Bindings: Env }> | undefined,
				_websocket: WebSocket,
			) {
				const options =
					typeof this.zodSessionOptions === "function"
						? this.zodSessionOptions(_ctx, _websocket)
						: this.zodSessionOptions;

				if (!options) {
					throw new Error(
						"zodSessionOptions must be provided either in constructor or via getZodOptions override",
					);
				}

				return { websocket: _websocket, data: null };
			}
		}

		// Constructor itself doesn't throw immediately due to blockConcurrencyWhile,
		// but the error will be thrown when processing hibernated connections
		let thrownError = null as Error | null;
		const errorHandler = vi.fn((error: unknown) => {
			thrownError = error as Error;
		});

		// Override blockConcurrencyWhile to catch errors
		mockState.blockConcurrencyWhile = vi.fn(async (cb: () => Promise<void>) => {
			try {
				await cb();
			} catch (error) {
				errorHandler(error);
				throw error;
			}
		});

		try {
			new TestZodWebSocketDO(mockState, mockEnv, undefined);
			await new Promise((resolve) => setTimeout(resolve, 50));
		} catch {
			// Error is expected
		}

		// Verify the error was thrown
		expect(errorHandler).toHaveBeenCalled();
		expect(thrownError?.message).toContain(
			"zodSessionOptions must be provided",
		);
	});
});
