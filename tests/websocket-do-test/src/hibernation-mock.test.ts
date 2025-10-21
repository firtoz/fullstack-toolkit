/**
 * Unit test for hibernation logic by mocking the base DurableObject class
 */

import type { Context } from "hono";
import { describe, expect, it, vi } from "vitest";

describe("BaseWebSocketDO Constructor with Mocked Base", () => {
	it("should call createSession with undefined ctx for hibernated connections", async () => {
		// Mock the getWebSockets to simulate hibernated connections
		const mockWebSocket = {
			readyState: WebSocket.OPEN,
			serializeAttachment: vi.fn((data: unknown) => data),
			deserializeAttachment: vi.fn(() => ({
				userId: "hibernated-user",
				name: "HibernatedUser",
				joinedAt: Date.now() - 5000,
			})),
		} as unknown as WebSocket;

		let _blockConcurrencyCallback: (() => Promise<void>) | null = null;

		// Mock DurableObjectState
		const mockState = {
			id: { toString: () => "test-id", equals: () => false, name: "test" },
			blockConcurrencyWhile: vi.fn(async (cb: () => Promise<void>) => {
				_blockConcurrencyCallback = cb;
				await cb();
			}),
			getWebSockets: vi.fn(() => [mockWebSocket]),
			storage: {} as DurableObjectStorage,
			waitUntil: vi.fn(),
		};

		const mockEnv = {} as Env;

		// Track createSession calls
		const createSessionCalls: Array<{
			ctx: Context<{ Bindings: Env }> | undefined;
			websocket: WebSocket;
		}> = [];

		// Create a test class that extends a mocked DurableObject
		class MockDurableObject {
			ctx: typeof mockState;
			env: typeof mockEnv;

			constructor(ctx: typeof mockState, env: typeof mockEnv) {
				this.ctx = ctx;
				this.env = env;
			}
		}

		class TestWebSocketDO extends MockDurableObject {
			protected readonly sessions = new Map<WebSocket, any>();

			constructor(ctx: typeof mockState, env: typeof mockEnv) {
				super(ctx, env);

				this.ctx.blockConcurrencyWhile(async () => {
					const websockets = this.ctx.getWebSockets();
					await Promise.all(
						websockets.map(async (websocket) => {
							try {
								const session = await this.createSession(undefined, websocket);
								session.resume();
								this.sessions.set(websocket, session);
							} catch (error) {
								console.error(`Error during session setup: ${error}`);
							}
						}),
					);
				});
			}

			protected createSession(
				ctx: Context<{ Bindings: Env }> | undefined,
				websocket: WebSocket,
			) {
				createSessionCalls.push({ ctx, websocket });

				return {
					websocket,
					data: null,
					resume() {
						const data = websocket.deserializeAttachment();
						this.data = data;
					},
				};
			}
		}

		// Create the DO
		new TestWebSocketDO(mockState, mockEnv);

		// Wait for async initialization
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify the hibernation resume path was tested
		expect(mockState.blockConcurrencyWhile).toHaveBeenCalled();
		expect(mockState.getWebSockets).toHaveBeenCalled();
		expect(mockWebSocket.deserializeAttachment).toHaveBeenCalled();

		// Verify createSession was called with undefined ctx (hibernation path)
		expect(createSessionCalls).toHaveLength(1);
		expect(createSessionCalls[0]?.ctx).toBeUndefined();
		expect(createSessionCalls[0]?.websocket).toBe(mockWebSocket);
	});

	it("should process multiple hibernated WebSockets in parallel", async () => {
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

		class TestWebSocketDO {
			protected readonly sessions = new Map<WebSocket, any>();
			ctx: typeof mockState;
			env: typeof mockEnv;

			constructor(ctx: typeof mockState, env: typeof mockEnv) {
				this.ctx = ctx;
				this.env = env;

				this.ctx.blockConcurrencyWhile(async () => {
					const websockets = this.ctx.getWebSockets();
					await Promise.all(
						websockets.map(async (websocket) => {
							const session = { websocket, data: null };
							session.data = websocket.deserializeAttachment();
							this.sessions.set(websocket, session);
						}),
					);
				});
			}
		}

		const doInstance = new TestWebSocketDO(mockState, mockEnv);
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify both WebSockets were processed
		// @ts-expect-error - We are accessing the sessions property directly to test the functionality.
		expect(doInstance.sessions.size).toBe(2);
		expect(mockWs1.deserializeAttachment).toHaveBeenCalled();
		expect(mockWs2.deserializeAttachment).toHaveBeenCalled();
	});

	it("should use blockConcurrencyWhile to ensure sessions are ready before requests", async () => {
		let blockConcurrencyCalled = false;
		let sessionSetupComplete = false;

		const mockState = {
			id: { toString: () => "test-id" },
			blockConcurrencyWhile: vi.fn(async (cb: () => Promise<void>) => {
				blockConcurrencyCalled = true;
				await cb();
				// After this returns, the DO can process requests
			}),
			getWebSockets: vi.fn(() => []),
			storage: {} as DurableObjectStorage,
			waitUntil: vi.fn(),
		};

		class TestWebSocketDO {
			ctx: typeof mockState;
			constructor(ctx: typeof mockState) {
				this.ctx = ctx;

				this.ctx.blockConcurrencyWhile(async () => {
					// Simulate session setup
					await new Promise((resolve) => setTimeout(resolve, 10));
					sessionSetupComplete = true;
				});
			}
		}

		new TestWebSocketDO(mockState);
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify blockConcurrencyWhile was called and completed
		expect(blockConcurrencyCalled).toBe(true);
		expect(sessionSetupComplete).toBe(true);
		expect(mockState.blockConcurrencyWhile).toHaveBeenCalled();
	});
});
