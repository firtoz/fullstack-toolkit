import { exports } from "cloudflare:workers";
import { StandardSchemaWebSocketClient } from "@firtoz/websocket-do";
import { assert, describe, expect, it, vi } from "vitest";
import type {
	ClientMessage,
	ServerMessage,
} from "./test-fixtures/StandardSchemaChatRoomDO";
import {
	ClientMessageSchema,
	ServerMessageSchema,
} from "./test-fixtures/StandardSchemaChatRoomDO";

// Import worker to make sure it's loaded
import "./test-fixtures/worker";

/**
 * Minimal WebSocket stand-in that forwards `send` to the worker's accepted socket.
 * Overriding `send` on a native Cloudflare WebSocket via `defineProperty` is unreliable
 * in vitest-pool-workers, so integration tests use this bridge instead of `new WebSocket(url)`.
 */
function createBridgedClientWebSocket(serverWs: WebSocket): WebSocket {
	const listenerMap = new Map<
		string,
		Set<EventListenerOrEventListenerObject>
	>();

	const stub = {
		binaryType: "blob" as BinaryType,
		readyState: WebSocket.OPEN,
		addEventListener(
			type: string,
			listener: EventListenerOrEventListenerObject,
		) {
			let set = listenerMap.get(type);
			if (!set) {
				set = new Set();
				listenerMap.set(type, set);
			}
			set.add(listener);
		},
		removeEventListener(
			type: string,
			listener: EventListenerOrEventListenerObject,
		) {
			listenerMap.get(type)?.delete(listener);
		},
		dispatchEvent(event: Event): boolean {
			const set = listenerMap.get(event.type);
			if (!set) {
				return true;
			}
			for (const l of set) {
				if (typeof l === "function") {
					l.call(stub as unknown as EventTarget, event);
				} else {
					l.handleEvent(event);
				}
			}
			return true;
		},
		send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
			if (data instanceof Blob) {
				throw new Error("Unexpected Blob in bridged send");
			}
			serverWs.send(data);
		},
		close(_code?: number, _reason?: string): void {
			// no-op for this test harness
		},
	};

	return stub as unknown as WebSocket;
}

describe("StandardSchemaWebSocketClient Integration Tests", () => {
	describe("JSON Mode Client", () => {
		it("should connect and send/receive JSON messages", async () => {
			// Get WebSocket URL from worker default export (simulating client connection)
			const response = await exports.default.fetch(
				"http://example.com/schema-chat-json/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			const serverWs = response.webSocket;
			assert(serverWs);
			const receivedMessages: ClientMessage[] = [];

			// Server-side message handler
			serverWs.addEventListener("message", (event) => {
				if (typeof event.data === "string") {
					receivedMessages.push(JSON.parse(event.data));
				}
			});

			serverWs.accept();

			const client = new StandardSchemaWebSocketClient<
				ClientMessage,
				ServerMessage
			>({
				webSocket: createBridgedClientWebSocket(serverWs),
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				enableBufferMessages: false,
			});

			await client.send({
				type: "message",
				text: "Hello from client!",
			});

			// Wait for message to be received by server
			await vi.waitFor(
				() => {
					expect(receivedMessages).toHaveLength(1);
				},
				{ timeout: 1000, interval: 20 },
			);

			expect(receivedMessages[0]).toMatchObject({
				type: "message",
				text: "Hello from client!",
			});
		});

		it("should validate outgoing messages", async () => {
			const client = new StandardSchemaWebSocketClient<
				ClientMessage,
				ServerMessage
			>({
				url: "ws://example.com/test",
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				enableBufferMessages: false,
			});

			// Mock WebSocket as open
			Object.defineProperty(client.socket, "readyState", {
				value: WebSocket.OPEN,
			});
			Object.defineProperty(client.socket, "send", {
				value: vi.fn(),
			});

			await expect(
				client.send({
					type: "message",
					// Missing 'text' field
				} as ClientMessage),
			).rejects.toThrow();
		});

		it("should handle validation errors on incoming messages", async () => {
			const validationErrors: { error: Error; rawMessage: unknown }[] = [];
			const client = new StandardSchemaWebSocketClient<
				ClientMessage,
				ServerMessage
			>({
				url: "ws://example.com/test",
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				enableBufferMessages: false,
				onValidationError: (error, rawMessage) => {
					validationErrors.push({ error, rawMessage });
				},
			});

			// Mock receiving an invalid message
			const mockEvent = new MessageEvent("message", {
				data: JSON.stringify({ type: "unknown", invalid: "data" }),
			});

			// Trigger message handler
			client.socket.dispatchEvent(mockEvent);

			// Wait a bit for async handling
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(validationErrors).toHaveLength(1);
			assert(validationErrors[0]);
			expect(validationErrors[0].rawMessage).toContain("unknown");
		});
	});

	describe("Buffer Mode Client", () => {
		it("should connect and send/receive buffer messages", async () => {
			// Get WebSocket URL from worker default export
			const response = await exports.default.fetch(
				"http://example.com/schema-chat/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			const serverWs = response.webSocket;
			assert(serverWs);
			const receivedMessages: ArrayBuffer[] = [];

			// Server-side message handler (buffers)
			serverWs.addEventListener("message", (event) => {
				if (event.data instanceof ArrayBuffer) {
					receivedMessages.push(event.data);
				}
			});

			serverWs.accept();

			const client = new StandardSchemaWebSocketClient<
				ClientMessage,
				ServerMessage
			>({
				webSocket: createBridgedClientWebSocket(serverWs),
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				enableBufferMessages: true,
			});

			// Send buffer message using client
			await client.send({
				type: "message",
				text: "Hello from buffer client!",
			});

			// Wait for message to be received by server
			await vi.waitFor(
				() => {
					expect(receivedMessages).toHaveLength(1);
				},
				{ timeout: 1000, interval: 20 },
			);

			expect(receivedMessages[0]).toBeInstanceOf(ArrayBuffer);
		});

		it("should reject JSON messages in buffer mode", () => {
			const validationErrors: { error: Error; rawMessage: unknown }[] = [];
			const client = new StandardSchemaWebSocketClient<
				ClientMessage,
				ServerMessage
			>({
				url: "ws://example.com/test",
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				enableBufferMessages: true,
				onValidationError: (error, rawMessage) => {
					validationErrors.push({ error, rawMessage });
				},
			});

			// Mock receiving a string message (should be rejected)
			const mockEvent = new MessageEvent("message", {
				data: JSON.stringify({ type: "message", text: "Should be rejected" }),
			});

			client.socket.dispatchEvent(mockEvent);

			expect(validationErrors).toHaveLength(1);
		});
	});

	describe("Client Utilities", () => {
		it("should expose readyState", () => {
			const client = new StandardSchemaWebSocketClient<
				ClientMessage,
				ServerMessage
			>({
				url: "ws://example.com/test",
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
			});

			expect(client.readyState).toBeDefined();
			expect(typeof client.readyState).toBe("number");
		});

		it("should allow closing connection", () => {
			const client = new StandardSchemaWebSocketClient<
				ClientMessage,
				ServerMessage
			>({
				url: "ws://example.com/test",
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
			});

			const closeSpy = vi.spyOn(client.socket, "close");
			client.close(1000, "Normal closure");

			expect(closeSpy).toHaveBeenCalledWith(1000, "Normal closure");
		});

		it("should wait for connection to open", async () => {
			const client = new StandardSchemaWebSocketClient<
				ClientMessage,
				ServerMessage
			>({
				url: "ws://example.com/test",
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
			});

			// Mock already open
			Object.defineProperty(client.socket, "readyState", {
				value: WebSocket.OPEN,
			});

			await expect(client.waitForOpen()).resolves.toBeUndefined();
		});
	});
});
