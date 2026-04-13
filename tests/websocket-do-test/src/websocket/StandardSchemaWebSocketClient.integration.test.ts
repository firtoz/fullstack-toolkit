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

			// Create client (using the server WebSocket as a mock client)
			const clientMessages: ServerMessage[] = [];
			const client = new StandardSchemaWebSocketClient<
				ClientMessage,
				ServerMessage
			>({
				url: "ws://example.com/schema-chat-json/websocket", // URL doesn't matter for testing
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				enableBufferMessages: false,
				onMessage: (msg) => clientMessages.push(msg),
			});

			// Replace the client's WebSocket with our test WebSocket
			// This simulates a real bidirectional connection
			const clientWs = client.socket;

			// Connect client's socket to server
			clientWs.addEventListener("message", (event) => {
				if (typeof event.data === "string") {
					const msg = JSON.parse(event.data) as ServerMessage;
					clientMessages.push(msg);
				}
			});

			// Mock the client accepting (for test purposes)
			Object.defineProperty(clientWs, "readyState", {
				value: WebSocket.OPEN,
				writable: true,
			});
			Object.defineProperty(clientWs, "send", {
				value: (data: string) => {
					serverWs.send(data);
				},
			});

			// Send message using client
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

			// Create client
			const clientMessages: ServerMessage[] = [];
			const client = new StandardSchemaWebSocketClient<
				ClientMessage,
				ServerMessage
			>({
				url: "ws://example.com/schema-chat/websocket",
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				enableBufferMessages: true,
				onMessage: (msg) => clientMessages.push(msg),
			});

			// Mock the client's WebSocket
			const clientWs = client.socket;

			Object.defineProperty(clientWs, "readyState", {
				value: WebSocket.OPEN,
				writable: true,
			});
			Object.defineProperty(clientWs, "send", {
				value: (data: ArrayBuffer) => {
					serverWs.send(data);
				},
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
