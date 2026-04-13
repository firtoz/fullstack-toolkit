/**
 * Unit tests for StandardSchemaWebSocketDO hibernation logic by mocking the base class
 */

import type {
	StandardSchemaSessionOptions,
	StandardSchemaSessionOptionsOrFactory,
} from "@firtoz/websocket-do";
import type { Context } from "hono";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

describe("StandardSchemaWebSocketDO Constructor Hibernation Unit Tests", () => {
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

		const staticOptions: StandardSchemaSessionOptionsOrFactory<
			ClientMessage,
			ServerMessage,
			Env
		> = {
			clientSchema: ClientMessageSchema,
			serverSchema: ServerMessageSchema,
			enableBufferMessages: true,
		};

		const createStandardSchemaSessionCalls: Array<{
			ctx: Context<{ Bindings: Env }> | undefined;
			websocket: WebSocket;
			options: StandardSchemaSessionOptions<ClientMessage, ServerMessage>;
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

		// Mock StandardSchemaWebSocketDO
		class TestStandardSchemaWebSocketDO extends MockDurableObject {
			protected readonly sessions = new Map<WebSocket, unknown>();

			constructor(
				ctx: typeof mockState,
				env: typeof mockEnv,
				protected standardSchemaSessionOptions: StandardSchemaSessionOptionsOrFactory<
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
					typeof this.standardSchemaSessionOptions === "function"
						? this.standardSchemaSessionOptions(ctx, websocket)
						: this.standardSchemaSessionOptions;

				if (!options) {
					throw new Error("standardSchemaSessionOptions must be provided");
				}

				return this.createStandardSchemaSession(ctx, websocket, options);
			}

			protected createStandardSchemaSession(
				ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
				options: StandardSchemaSessionOptions<ClientMessage, ServerMessage>,
			) {
				createStandardSchemaSessionCalls.push({ ctx, websocket, options });

				return {
					websocket,
					data: null,
					resume() {
						this.data = websocket.deserializeAttachment();
					},
				};
			}
		}

		new TestStandardSchemaWebSocketDO(mockState, mockEnv, staticOptions);
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify createStandardSchemaSession was called correctly
		expect(createStandardSchemaSessionCalls).toHaveLength(1);
		expect(createStandardSchemaSessionCalls[0]?.ctx).toBeUndefined();
		expect(createStandardSchemaSessionCalls[0]?.websocket).toBe(mockWebSocket);
		expect(createStandardSchemaSessionCalls[0]?.options).toBe(staticOptions);
		expect(
			createStandardSchemaSessionCalls[0]?.options.enableBufferMessages,
		).toBe(true);
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

		class TestStandardSchemaWebSocketDO extends MockDurableObject {
			protected readonly sessions = new Map<WebSocket, unknown>();

			constructor(
				ctx: typeof mockState,
				env: typeof mockEnv,
				protected standardSchemaSessionOptions: typeof optionsFactory,
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
					typeof this.standardSchemaSessionOptions === "function"
						? this.standardSchemaSessionOptions(ctx, websocket)
						: this.standardSchemaSessionOptions;

				if (!options) {
					throw new Error("standardSchemaSessionOptions must be provided");
				}

				return this.createStandardSchemaSession(ctx, websocket, options);
			}

			protected createStandardSchemaSession(
				_ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
				_options: StandardSchemaSessionOptions<ClientMessage, ServerMessage>,
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

		new TestStandardSchemaWebSocketDO(mockState, mockEnv, optionsFactory);
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

		const optionsFromFactory: StandardSchemaSessionOptions<
			ClientMessage,
			ServerMessage
		>[] = [];

		// Factory that returns different options for hibernated vs fresh connections
		const optionsFactory = (
			ctx: Context<{ Bindings: Env }> | undefined,
			_websocket: WebSocket,
		) => {
			const options: StandardSchemaSessionOptions<
				ClientMessage,
				ServerMessage
			> = {
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

		class TestStandardSchemaWebSocketDO extends MockDurableObject {
			protected readonly sessions = new Map<WebSocket, unknown>();

			constructor(
				ctx: typeof mockState,
				env: typeof mockEnv,
				protected standardSchemaSessionOptions: typeof optionsFactory,
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
					typeof this.standardSchemaSessionOptions === "function"
						? this.standardSchemaSessionOptions(ctx, websocket)
						: this.standardSchemaSessionOptions;

				if (!options) {
					throw new Error("standardSchemaSessionOptions must be provided");
				}

				return this.createStandardSchemaSession(ctx, websocket, options);
			}

			protected createStandardSchemaSession(
				_ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
				_options: StandardSchemaSessionOptions<ClientMessage, ServerMessage>,
			) {
				return { websocket, data: null };
			}
		}

		new TestStandardSchemaWebSocketDO(mockState, mockEnv, optionsFactory);
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

		class TestStandardSchemaWebSocketDO extends MockDurableObject {
			protected readonly sessions = new Map<WebSocket, unknown>();

			constructor(
				ctx: typeof mockState,
				env: typeof mockEnv,
				protected standardSchemaSessionOptions: typeof optionsFactory,
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
					typeof this.standardSchemaSessionOptions === "function"
						? this.standardSchemaSessionOptions(ctx, websocket)
						: this.standardSchemaSessionOptions;

				return this.createStandardSchemaSession(ctx, websocket, options);
			}

			protected createStandardSchemaSession(
				_ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
				_options: StandardSchemaSessionOptions<ClientMessage, ServerMessage>,
			) {
				return { websocket, data: null };
			}
		}

		const doInstance = new TestStandardSchemaWebSocketDO(
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

		class TestStandardSchemaWebSocketDO extends MockDurableObject {
			protected readonly sessions = new Map<WebSocket, unknown>();

			constructor(
				ctx: typeof mockState,
				env: typeof mockEnv,
				protected standardSchemaSessionOptions?:
					| StandardSchemaSessionOptionsOrFactory<
							ClientMessage,
							ServerMessage,
							Env
					  >
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
					typeof this.standardSchemaSessionOptions === "function"
						? this.standardSchemaSessionOptions(_ctx, _websocket)
						: this.standardSchemaSessionOptions;

				if (!options) {
					throw new Error(
						"standardSchemaSessionOptions must be provided either in constructor or via getStandardSchemaSessionOptions override",
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
			new TestStandardSchemaWebSocketDO(mockState, mockEnv, undefined);
			await new Promise((resolve) => setTimeout(resolve, 50));
		} catch {
			// Error is expected
		}

		// Verify the error was thrown
		expect(errorHandler).toHaveBeenCalled();
		expect(thrownError?.message).toContain(
			"standardSchemaSessionOptions must be provided",
		);
	});
});
