import { SELF } from "cloudflare:test";
import { pack, unpack } from "msgpackr";
import { describe, expect, it, vi } from "vitest";
import type {
	ClientMessage,
	ServerMessage,
} from "./test-fixtures/ZodChatRoomDO";

// Import the worker to load it into the test environment
import "./test-fixtures/worker";

describe("ZodSession Integration Tests", () => {
	describe("WebSocket Connection with Zod Validation (JSON mode)", () => {
		it("should establish websocket connection and validate messages", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat-json/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			expect(response.status).toBe(101);
			expect(response.webSocket).toBeDefined();

			const ws = response.webSocket!;

			// Mock message handling
			const messages: ServerMessage[] = [];
			ws.addEventListener("message", (event) => {
				messages.push(JSON.parse(event.data as string));
			});

			ws.accept();

			// Test valid message
			const validMessage: ClientMessage = {
				type: "message",
				text: "Hello, world!",
			};

			ws.send(JSON.stringify(validMessage));

			// Wait for the message to arrive
			await vi.waitFor(
				() => {
					expect(messages).toHaveLength(1);
				},
				{ timeout: 1000, interval: 20 },
			);

			// Validate the message content
			expect(messages[0]).toMatchObject({
				type: "message",
				text: "Hello, world!",
			});
		});

		it("should reject invalid messages and send error", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat-json/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			const ws = response.webSocket!;
			const messages: ServerMessage[] = [];

			ws.addEventListener("message", (event) => {
				messages.push(JSON.parse(event.data as string));
			});

			ws.accept();

			// Test invalid message (missing required field)
			const invalidMessage = {
				type: "message",
				// missing 'text' field
			};

			ws.send(JSON.stringify(invalidMessage));

			// Wait for the error message to arrive
			await vi.waitFor(
				() => {
					expect(messages).toHaveLength(1);
				},
				{ timeout: 1000, interval: 20 },
			);

			expect(messages[0]).toMatchObject({
				type: "error",
				message: "Invalid message format",
			});
		});

		it("should validate message content constraints", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat-json/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			const ws = response.webSocket!;
			const messages: ServerMessage[] = [];

			ws.addEventListener("message", (event) => {
				messages.push(JSON.parse(event.data as string));
			});

			ws.accept();

			// Test message that's too long (over 1000 chars)
			const longMessage: any = {
				type: "message",
				text: "a".repeat(1001), // Exceeds max length
			};

			ws.send(JSON.stringify(longMessage));

			// Wait for the validation error message to arrive
			await vi.waitFor(
				() => {
					expect(messages).toHaveLength(1);
				},
				{ timeout: 1000, interval: 20 },
			);

			// Validate the error message content
			expect(messages[0]).toMatchObject({
				type: "error",
				message: "Invalid message format",
			});
		});
	});

	describe("Buffer Message Support with msgpack", () => {
		it("should handle msgpack encoded messages and respond with buffers", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			const ws = response.webSocket!;
			const messages: ServerMessage[] = [];

			// Listen for BUFFER messages (not string)
			ws.addEventListener("message", (event) => {
				if (event.data instanceof ArrayBuffer) {
					const decoded = unpack(new Uint8Array(event.data)) as ServerMessage;
					messages.push(decoded);
				}
			});

			ws.accept();

			// Test valid msgpack message
			const validMessage: ClientMessage = {
				type: "setName",
				name: "TestUser",
			};

			// Encode with msgpack
			const packedMessage = pack(validMessage);
			ws.send(packedMessage);

			// Wait for the nameChanged message to arrive
			await vi.waitFor(
				() => {
					expect(messages).toHaveLength(1);
				},
				{ timeout: 1000, interval: 20 },
			);

			// Validate the nameChanged message
			expect(messages[0]).toMatchObject({
				type: "nameChanged",
				newName: "TestUser",
			});
		});

		it("should reject invalid msgpack messages and respond with buffer error", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			const ws = response.webSocket!;
			const messages: ServerMessage[] = [];

			// Listen for BUFFER messages
			ws.addEventListener("message", (event) => {
				if (event.data instanceof ArrayBuffer) {
					const decoded = unpack(new Uint8Array(event.data)) as ServerMessage;
					messages.push(decoded);
				}
			});

			ws.accept();

			// Test invalid msgpack message
			const invalidMessage = {
				type: "setName",
				// missing 'name' field
			};

			const packedMessage = pack(invalidMessage);
			ws.send(packedMessage);

			// Wait for the error message to arrive
			await vi.waitFor(
				() => {
					expect(messages).toHaveLength(1);
				},
				{ timeout: 1000, interval: 20 },
			);

			expect(messages[0]).toMatchObject({
				type: "error",
				message: "Invalid message format",
			});
		});

		it("should handle corrupted buffer data gracefully", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			const ws = response.webSocket!;
			const messages: ServerMessage[] = [];

			// Listen for BUFFER messages
			ws.addEventListener("message", (event) => {
				if (event.data instanceof ArrayBuffer) {
					const decoded = unpack(new Uint8Array(event.data)) as ServerMessage;
					messages.push(decoded);
				}
			});

			ws.accept();

			// Send corrupted binary data
			const corruptedData = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]);
			ws.send(corruptedData);

			// Wait for the error message to arrive
			await vi.waitFor(
				() => {
					expect(messages).toHaveLength(1);
				},
				{ timeout: 1000, interval: 20 },
			);

			// Validate the decode error message
			expect(messages[0]).toMatchObject({
				type: "error",
				message: "Invalid message format",
			});
		});
	});

	describe("Protocol Enforcement", () => {
		it("should reject JSON messages when buffer mode is enabled", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			const ws = response.webSocket!;
			const messages: any[] = [];

			// Listen for any messages (JSON or buffer)
			ws.addEventListener("message", (event) => {
				if (typeof event.data === "string") {
					messages.push(JSON.parse(event.data));
				} else if (event.data instanceof ArrayBuffer) {
					messages.push(unpack(new Uint8Array(event.data)));
				}
			});

			ws.accept();

			// Try to send JSON message when buffer mode is enabled
			const jsonMessage = { type: "message", text: "Should be rejected" };
			ws.send(JSON.stringify(jsonMessage));

			// Wait for protocol error
			await vi.waitFor(
				() => {
					expect(messages).toHaveLength(1);
				},
				{ timeout: 1000, interval: 20 },
			);

			// Should receive protocol error (as JSON for compatibility)
			expect(messages[0]).toMatchObject({
				error: "String messages are not allowed. Please use buffer messages.",
			});
		});

		it("should silently ignore buffer messages when buffer mode is disabled", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat-json/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			const ws = response.webSocket!;
			const messages: ServerMessage[] = [];

			ws.addEventListener("message", (event) => {
				if (typeof event.data === "string") {
					messages.push(JSON.parse(event.data));
				}
			});

			ws.accept();

			// Try to send buffer message when JSON mode is enabled
			const bufferMessage = pack({
				type: "message",
				text: "Should be ignored",
			});
			ws.send(bufferMessage);

			// Wait and verify no response (silently ignored)
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should have no messages (buffer messages are silently ignored in JSON mode)
			expect(messages).toHaveLength(0);
		});
	});

	describe("Discriminated Union Message Types", () => {
		it("should properly validate discriminated union types", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat-json/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			const ws = response.webSocket!;
			const messages: ServerMessage[] = [];

			ws.addEventListener("message", (event) => {
				messages.push(JSON.parse(event.data as string));
			});

			ws.accept();

			// Test each message type in the discriminated union
			const messageTypes: ClientMessage[] = [
				{ type: "message", text: "Hello" },
				{ type: "setName", name: "NewName" },
			];

			// Send all messages
			for (const message of messageTypes) {
				ws.send(JSON.stringify(message));
			}

			// Wait for both messages to be processed
			await vi.waitFor(
				() => {
					expect(messages.length).toBeGreaterThanOrEqual(2);
				},
				{ timeout: 1000, interval: 20 },
			);

			// Validate message contents
			expect(messages[0]).toMatchObject({
				type: "message",
				text: "Hello",
			});

			expect(messages[1]).toMatchObject({
				type: "nameChanged",
				newName: "NewName",
			});
		});

		it("should reject unknown message types", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat-json/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			const ws = response.webSocket!;
			const messages: ServerMessage[] = [];

			ws.addEventListener("message", (event) => {
				messages.push(JSON.parse(event.data as string));
			});

			ws.accept();

			// Test unknown message type
			const unknownMessage = {
				type: "unknown",
				data: "some data",
			};

			ws.send(JSON.stringify(unknownMessage));

			// Wait for the error message to arrive
			await vi.waitFor(
				() => {
					expect(messages).toHaveLength(1);
				},
				{ timeout: 1000, interval: 20 },
			);

			expect(messages[0]).toMatchObject({
				type: "error",
				message: "Invalid message format",
			});
		});
	});

	describe("Session Management", () => {
		it("should track session info correctly", async () => {
			// Test the /info endpoint
			const infoResponse = await SELF.fetch(
				"http://example.com/zod-chat-json/info",
				{
					method: "POST",
				},
			);

			expect(infoResponse.status).toBe(200);

			const info = (await infoResponse.json()) as {
				sessionCount: number;
				sessions: any[];
			};
			expect(info).toHaveProperty("sessionCount");
			expect(info).toHaveProperty("sessions");
			expect(Array.isArray(info.sessions)).toBe(true);
		});

		it("should handle multiple concurrent sessions with validation", async () => {
			// Create multiple WebSocket connections
			const connections = await Promise.all([
				SELF.fetch("http://example.com/zod-chat-json/websocket", {
					headers: { Upgrade: "websocket" },
				}),
				SELF.fetch("http://example.com/zod-chat-json/websocket", {
					headers: { Upgrade: "websocket" },
				}),
			]);

			const websockets = connections.map((response) => {
				expect(response.status).toBe(101);
				expect(response.webSocket).toBeDefined();
				return response.webSocket!;
			});

			// Accept all connections
			websockets.forEach((ws) => {
				ws.accept();
			});

			// Send messages from different sessions
			websockets[0]!.send(
				JSON.stringify({ type: "message", text: "From session 1" }),
			);
			websockets[1]!.send(
				JSON.stringify({ type: "message", text: "From session 2" }),
			);

			// Wait a moment for messages to be processed (we don't need to wait for specific messages in this test)
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Check session count via info endpoint (must match the websocket endpoint)
			const infoResponse = await SELF.fetch(
				"http://example.com/zod-chat-json/info",
				{
					method: "POST",
				},
			);
			const info = (await infoResponse.json()) as {
				sessionCount: number;
				sessions: any[];
			};

			expect(info.sessionCount).toBe(2);
			expect(info.sessions).toHaveLength(2);
		});
	});
});
