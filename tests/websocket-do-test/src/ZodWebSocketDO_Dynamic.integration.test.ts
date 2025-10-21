import { SELF } from "cloudflare:test";
import { pack, unpack } from "msgpackr";
import { assert, describe, expect, it, vi } from "vitest";
import type {
	ClientMessage,
	ServerMessage,
	SessionData,
} from "./test-fixtures/ZodChatRoomDO_Dynamic";

// Import the worker to load it into the test environment
import "./test-fixtures/worker";

describe("ZodWebSocketDO_Dynamic Integration Tests", () => {
	describe("Query Parameter-Based Format Switching", () => {
		it("should use JSON format when format=json query param is set", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat-dynamic/websocket?format=json",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			expect(response.status).toBe(101);
			expect(response.webSocket).toBeDefined();

			const ws = response.webSocket;
			assert(ws);

			const messages: ServerMessage[] = [];
			ws.addEventListener("message", (event) => {
				if (typeof event.data === "string") {
					messages.push(JSON.parse(event.data));
				}
			});

			ws.accept();

			// Send JSON message
			const validMessage: ClientMessage = {
				type: "message",
				text: "Hello in JSON!",
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
				text: "Hello in JSON!",
			});

			ws.close();
		});

		it("should use buffer format when format=buffer query param is set", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat-dynamic/websocket?format=buffer",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			expect(response.status).toBe(101);
			expect(response.webSocket).toBeDefined();

			const ws = response.webSocket;
			assert(ws);

			const messages: ServerMessage[] = [];
			// Listen for BUFFER messages
			ws.addEventListener("message", (event) => {
				if (event.data instanceof ArrayBuffer) {
					const decoded = unpack(new Uint8Array(event.data)) as ServerMessage;
					messages.push(decoded);
				}
			});

			ws.accept();

			// Send buffer message
			const validMessage: ClientMessage = {
				type: "message",
				text: "Hello in buffer!",
			};

			const packedMessage = pack(validMessage);
			ws.send(packedMessage);

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
				text: "Hello in buffer!",
			});

			ws.close();
		});

		it("should default to JSON when no format query param is provided", async () => {
			const response = await SELF.fetch(
				"http://example.com/zod-chat-dynamic/websocket",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			expect(response.status).toBe(101);
			expect(response.webSocket).toBeDefined();

			const ws = response.webSocket;
			assert(ws);

			const messages: ServerMessage[] = [];
			ws.addEventListener("message", (event) => {
				if (typeof event.data === "string") {
					messages.push(JSON.parse(event.data));
				}
			});

			ws.accept();

			// Send JSON message (should work with default)
			const validMessage: ClientMessage = {
				type: "message",
				text: "Hello with default!",
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
				text: "Hello with default!",
			});

			ws.close();
		});

		it("should track the format in session data", async () => {
			// Connect with buffer format
			const response1 = await SELF.fetch(
				"http://example.com/zod-chat-dynamic/websocket?format=buffer",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);
			const ws1 = response1.webSocket;
			assert(ws1);
			ws1.accept();

			// Connect with JSON format
			const response2 = await SELF.fetch(
				"http://example.com/zod-chat-dynamic/websocket?format=json",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);
			const ws2 = response2.webSocket;
			assert(ws2);
			ws2.accept();

			// Wait for connections to establish
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Check session info
			const infoResponse = await SELF.fetch(
				"http://example.com/zod-chat-dynamic/info",
				{
					method: "POST",
				},
			);

			expect(infoResponse.status).toBe(200);

			const info = await infoResponse.json<{
				sessionCount: number;
				sessions: (SessionData & { format: "json" | "buffer" })[];
			}>();

			expect(info.sessionCount).toBe(2);
			expect(info.sessions).toHaveLength(2);

			// Verify that one session has buffer format and one has JSON
			const bufferSession = info.sessions.find((s) => s.format === "buffer");
			const jsonSession = info.sessions.find((s) => s.format === "json");

			expect(bufferSession).toBeDefined();
			expect(jsonSession).toBeDefined();

			ws1.close();
			ws2.close();
		});

		it("should enforce protocol based on query param", async () => {
			// Connect with buffer format
			const response = await SELF.fetch(
				"http://example.com/zod-chat-dynamic/websocket?format=buffer",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			const ws = response.webSocket;
			assert(ws);

			const messages: (ServerMessage | { error: string })[] = [];
			ws.addEventListener("message", (event) => {
				if (typeof event.data === "string") {
					messages.push(JSON.parse(event.data));
				} else if (event.data instanceof ArrayBuffer) {
					messages.push(unpack(new Uint8Array(event.data)));
				}
			});

			ws.accept();

			// Try to send JSON message when buffer format is expected
			ws.send(JSON.stringify({ type: "message", text: "Should fail" }));

			// Wait for protocol error
			await vi.waitFor(
				() => {
					expect(messages).toHaveLength(1);
				},
				{ timeout: 1000, interval: 20 },
			);

			// Should receive protocol error
			expect(messages[0]).toMatchObject({
				error: "String messages are not allowed. Please use buffer messages.",
			});

			ws.close();
		});

		it("should allow broadcasting between sessions with different formats", async () => {
			// Connect with buffer format
			const response1 = await SELF.fetch(
				"http://example.com/zod-chat-dynamic/websocket?format=buffer",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);
			const ws1 = response1.webSocket;
			assert(ws1);
			const bufferMessages: ServerMessage[] = [];
			ws1.addEventListener("message", (event) => {
				if (event.data instanceof ArrayBuffer) {
					bufferMessages.push(unpack(new Uint8Array(event.data)));
				}
			});
			ws1.accept();

			// Connect with JSON format
			const response2 = await SELF.fetch(
				"http://example.com/zod-chat-dynamic/websocket?format=json",
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);
			const ws2 = response2.webSocket;
			assert(ws2);
			const jsonMessages: ServerMessage[] = [];
			ws2.addEventListener("message", (event) => {
				if (typeof event.data === "string") {
					jsonMessages.push(JSON.parse(event.data));
				}
			});
			ws2.accept();

			// Wait for connections to establish
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Send message from buffer client
			const bufferMessage: ClientMessage = {
				type: "message",
				text: "From buffer client",
			};
			ws1.send(pack(bufferMessage));

			// Wait for message to be broadcast
			await vi.waitFor(
				() => {
					expect(jsonMessages.length).toBeGreaterThan(0);
					expect(bufferMessages.length).toBeGreaterThan(0);
				},
				{ timeout: 1000, interval: 20 },
			);

			// Both clients should receive the message in their respective formats
			const jsonMsg = jsonMessages.find(
				(m) => m.type === "message" && m.text === "From buffer client",
			);
			const bufferMsg = bufferMessages.find(
				(m) => m.type === "message" && m.text === "From buffer client",
			);

			expect(jsonMsg).toBeDefined();
			expect(bufferMsg).toBeDefined();

			ws1.close();
			ws2.close();
		});
	});
});
