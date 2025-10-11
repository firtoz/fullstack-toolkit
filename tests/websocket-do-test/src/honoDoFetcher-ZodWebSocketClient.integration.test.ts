/**
 * Integration tests for honoDoFetcher + ZodWebSocketClient
 *
 * This test file demonstrates how to combine:
 * - honoDoFetcher: Type-safe DO fetcher with WebSocket support
 * - ZodWebSocketClient: Type-safe WebSocket client with Zod validation
 *
 * Together they provide end-to-end type safety from DO connection to message validation.
 */

import { env, SELF } from "cloudflare:test";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";
import { ZodWebSocketClient } from "@firtoz/websocket-do";
import { assert, describe, expect, it, vi } from "vitest";
import {
	type ClientMessage as BufferClientMessage,
	ClientMessageSchema as BufferClientMessageSchema,
	type ServerMessage as BufferServerMessage,
	ServerMessageSchema as BufferServerMessageSchema,
} from "./test-fixtures/ZodChatRoomDO";
import {
	type ClientMessage,
	ClientMessageSchema,
	type ServerMessage,
	ServerMessageSchema,
} from "./test-fixtures/ZodChatRoomDO_JSON";
import "./test-fixtures/worker";

describe("honoDoFetcher + ZodWebSocketClient Integration", () => {
	describe("Basic Integration", () => {
		it("should connect to DO WebSocket and use ZodWebSocketClient for type-safe communication", async () => {
			const roomId = "test-hono-zod-integration";
			const api = honoDoFetcherWithName(env.ZOD_CHAT_ROOM_JSON, roomId);

			// Step 1: Use honoDoFetcher to get a WebSocket connection to the DO
			// Note: We use config.autoAccept = false because ZodWebSocketClient
			// needs to set up listeners before the connection is fully established
			const wsResp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});

			expect(wsResp.status).toBe(101);
			expect(wsResp.webSocket).not.toBeNull();

			if (!wsResp.webSocket) throw new Error("Expected WebSocket");
			const ws = wsResp.webSocket;

			// Step 2: Wrap the existing WebSocket with ZodWebSocketClient!
			const messages: ServerMessage[] = [];

			const client = new ZodWebSocketClient({
				webSocket: ws, // Use the existing WebSocket from honoDoFetcher
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				enableBufferMessages: false,
				onMessage: (message) => {
					messages.push(message);
				},
			});

			// Now accept the WebSocket
			ws.accept();

			// Step 3: Send type-safe messages using ZodWebSocketClient
			const messageToSend: ClientMessage = {
				type: "message",
				text: "Hello from Zod + honoDoFetcher!",
			};

			// ZodWebSocketClient automatically validates and encodes!
			client.send(messageToSend);

			// Wait for the message to be received
			await vi.waitFor(() => {
				expect(messages.length).toBeGreaterThan(0);
			});

			const chatMessage = messages.find((m) => m.type === "message");
			expect(chatMessage).toBeDefined();
			if (chatMessage && chatMessage.type === "message") {
				expect(chatMessage.text).toBe("Hello from Zod + honoDoFetcher!");
			}

			// Step 4: Verify session via HTTP endpoint
			const infoResp = await api.post({ url: "/info" });
			const info = await infoResp.json();
			expect(info.sessionCount).toBe(1);

			client.close();
		});

		it("should handle multiple clients with full type safety", async () => {
			const roomId = "test-multi-client-zod";
			const api = honoDoFetcherWithName(env.ZOD_CHAT_ROOM_JSON, roomId);

			// Create two clients
			const client1Messages: ServerMessage[] = [];
			const client2Messages: ServerMessage[] = [];

			// Connect first client with ZodWebSocketClient
			const ws1Resp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!ws1Resp.webSocket) throw new Error("Expected WebSocket 1");

			const client1 = new ZodWebSocketClient({
				webSocket: ws1Resp.webSocket,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				onMessage: (message) => client1Messages.push(message),
			});
			ws1Resp.webSocket.accept();

			// Connect second client with ZodWebSocketClient
			const ws2Resp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!ws2Resp.webSocket) throw new Error("Expected WebSocket 2");

			const client2 = new ZodWebSocketClient({
				webSocket: ws2Resp.webSocket,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				onMessage: (message) => client2Messages.push(message),
			});
			ws2Resp.webSocket.accept();

			// Client 1 sends a message using ZodWebSocketClient
			const msg1: ClientMessage = {
				type: "message",
				text: "Message from client 1",
			};
			client1.send(msg1); // Automatic validation and encoding!

			// Wait for both clients to receive the message
			await vi.waitFor(() => {
				expect(client1Messages.length).toBeGreaterThan(0);
				expect(client2Messages.length).toBeGreaterThan(0);
			});

			const client1Received = client1Messages.find(
				(m) => m.type === "message" && m.text === "Message from client 1",
			);
			const client2Received = client2Messages.find(
				(m) => m.type === "message" && m.text === "Message from client 1",
			);

			expect(client1Received).toBeDefined();
			expect(client2Received).toBeDefined();

			// Verify both sessions exist
			const infoResp = await api.post({ url: "/info" });
			const info = await infoResp.json();
			expect(info.sessionCount).toBe(2);

			client1.close();
			client2.close();
		});
	});

	describe("Type Safety and Validation", () => {
		it("should enforce message type safety with Zod schemas", async () => {
			const roomId = "test-type-safety";
			const api = honoDoFetcherWithName(env.ZOD_CHAT_ROOM_JSON, roomId);

			const wsResp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!wsResp.webSocket) throw new Error("Expected WebSocket");

			const messages: ServerMessage[] = [];
			const errors: unknown[] = [];

			const client = new ZodWebSocketClient({
				webSocket: wsResp.webSocket,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				onMessage: (message) => messages.push(message),
				onValidationError: (error) => errors.push(error),
			});

			wsResp.webSocket.accept();

			// Send a valid message using ZodWebSocketClient
			const validMsg: ClientMessage = {
				type: "setName",
				name: "ValidName",
			};
			client.send(validMsg); // Automatic validation!

			// Wait for nameChanged message
			await vi.waitFor(() => {
				expect(messages.length).toBeGreaterThan(0);
			});

			const nameChanged = messages.find((m) => m.type === "nameChanged");
			expect(nameChanged).toBeDefined();
			if (nameChanged && nameChanged.type === "nameChanged") {
				expect(nameChanged.newName).toBe("ValidName");
			}

			// No validation errors
			expect(errors.length).toBe(0);

			client.close();
		});

		it("should handle validation errors gracefully", async () => {
			const roomId = "test-validation-errors";
			const api = honoDoFetcherWithName(env.ZOD_CHAT_ROOM_JSON, roomId);

			const wsResp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!wsResp.webSocket) throw new Error("Expected WebSocket");

			const validMessages: ServerMessage[] = [];
			const validationErrors: unknown[] = [];

			const client = new ZodWebSocketClient({
				webSocket: wsResp.webSocket,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				onMessage: (message) => validMessages.push(message),
				onValidationError: (error) => validationErrors.push(error),
			});

			wsResp.webSocket.accept();

			// Try to send an invalid message (will fail client-side validation)
			const invalidMsg = {
				type: "message",
				// Missing 'text' field - should fail validation
			} as ClientMessage;

			// ZodWebSocketClient.send() will throw on invalid messages
			expect(() => {
				client.send(invalidMsg);
			}).toThrow();

			// We can manually send an invalid message to test server-side validation
			wsResp.webSocket.send(JSON.stringify(invalidMsg));

			// Wait for server error response
			await vi.waitFor(() => {
				expect(validMessages.length).toBeGreaterThan(0);
			});

			const errorMsg = validMessages.find((m) => m.type === "error");
			expect(errorMsg).toBeDefined();

			client.close();
		});

		it("should validate message constraints (min/max lengths)", async () => {
			const roomId = "test-constraints";
			const api = honoDoFetcherWithName(env.ZOD_CHAT_ROOM_JSON, roomId);

			const wsResp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!wsResp.webSocket) throw new Error("Expected WebSocket");
			const ws = wsResp.webSocket;

			ws.accept();

			// Try to create a message with text that's too long (>1000 chars)
			const longText = "a".repeat(1001);
			const invalidMsg = {
				type: "message" as const,
				text: longText,
			};

			// Should fail client-side validation
			expect(() => {
				ClientMessageSchema.parse(invalidMsg);
			}).toThrow();

			// Valid message with text within limits
			const validMsg: ClientMessage = {
				type: "message",
				text: "a".repeat(1000), // Exactly at limit
			};

			// Should pass validation
			expect(() => {
				ClientMessageSchema.parse(validMsg);
			}).not.toThrow();

			ws.close();
		});
	});

	describe("Real-World Scenarios", () => {
		it("should handle a complete chat flow with type safety", async () => {
			const roomId = "test-chat-flow";
			const api = honoDoFetcherWithName(env.ZOD_CHAT_ROOM_JSON, roomId);

			// Alice joins the room using ZodWebSocketClient
			const aliceResp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!aliceResp.webSocket) throw new Error("Expected WebSocket");

			const aliceMessages: ServerMessage[] = [];
			const alice = new ZodWebSocketClient({
				webSocket: aliceResp.webSocket,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				onMessage: (message) => aliceMessages.push(message),
			});
			aliceResp.webSocket.accept();

			// Alice sets her name using ZodWebSocketClient
			alice.send({
				type: "setName",
				name: "Alice",
			});

			// Bob joins the room using ZodWebSocketClient
			const bobResp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!bobResp.webSocket) throw new Error("Expected WebSocket");

			const bobMessages: ServerMessage[] = [];
			const bob = new ZodWebSocketClient({
				webSocket: bobResp.webSocket,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				onMessage: (message) => bobMessages.push(message),
			});
			bobResp.webSocket.accept();

			// Bob sets his name using ZodWebSocketClient
			bob.send({
				type: "setName",
				name: "Bob",
			});

			// Alice sends a message using ZodWebSocketClient
			alice.send({
				type: "message",
				text: "Hello Bob!",
			});

			// Wait for Bob to receive Alice's message
			await vi.waitFor(() => {
				expect(
					bobMessages.some(
						(m) => m.type === "message" && m.text === "Hello Bob!",
					),
				).toBe(true);
			});

			const bobReceivedMsg = bobMessages.find(
				(m) => m.type === "message" && m.text === "Hello Bob!",
			);
			expect(bobReceivedMsg).toBeDefined();
			if (bobReceivedMsg && bobReceivedMsg.type === "message") {
				expect(bobReceivedMsg.from).toBe("Alice");
			}

			// Bob replies using ZodWebSocketClient
			bob.send({
				type: "message",
				text: "Hi Alice!",
			});

			// Wait for Alice to receive Bob's reply
			await vi.waitFor(() => {
				expect(
					aliceMessages.some(
						(m) => m.type === "message" && m.text === "Hi Alice!",
					),
				).toBe(true);
			});

			const aliceReceivedReply = aliceMessages.find(
				(m) => m.type === "message" && m.text === "Hi Alice!",
			);
			expect(aliceReceivedReply).toBeDefined();
			if (aliceReceivedReply && aliceReceivedReply.type === "message") {
				expect(aliceReceivedReply.from).toBe("Bob");
			}

			// Verify session info via HTTP
			const infoResp = await api.post({ url: "/info" });
			const info = await infoResp.json();
			expect(info.sessionCount).toBe(2);
			expect(info.sessions.some((s) => s.name === "Alice")).toBe(true);
			expect(info.sessions.some((s) => s.name === "Bob")).toBe(true);

			alice.close();
			bob.close();
		});

		it("should demonstrate the power of combining both libraries", async () => {
			const roomId = "test-power-combo";

			// Part 1: Use honoDoFetcher for type-safe DO access
			const api = honoDoFetcherWithName(env.ZOD_CHAT_ROOM_JSON, roomId);

			// Verify room is empty via HTTP endpoint
			const initialInfo = await api.post({ url: "/info" });
			const initial = await initialInfo.json();
			expect(initial.sessionCount).toBe(0);

			// Part 2: Connect via WebSocket using honoDoFetcher
			const wsResp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!wsResp.webSocket) throw new Error("Expected WebSocket");

			// Part 3: Wrap with ZodWebSocketClient for automatic validation
			const messages: ServerMessage[] = [];
			const client = new ZodWebSocketClient({
				webSocket: wsResp.webSocket,
				clientSchema: ClientMessageSchema,
				serverSchema: ServerMessageSchema,
				onMessage: (message) => messages.push(message),
			});
			wsResp.webSocket.accept();

			// Part 4: Send type-safe messages with automatic validation
			const msg: ClientMessage = {
				type: "message",
				text: "Type safety FTW!",
			};
			client.send(msg); // No manual JSON.stringify or validation needed!

			// Part 5: Verify via HTTP that session exists
			const afterInfo = await api.post({ url: "/info" });
			const after = await afterInfo.json();
			expect(after.sessionCount).toBe(1);

			// Part 6: All messages are type-safe and validated automatically
			messages.forEach((message) => {
				// TypeScript knows the exact shape of each message
				switch (message.type) {
					case "message":
						expect(typeof message.text).toBe("string");
						expect(typeof message.from).toBe("string");
						expect(typeof message.userId).toBe("string");
						break;
					case "nameChanged":
						expect(typeof message.oldName).toBe("string");
						expect(typeof message.newName).toBe("string");
						break;
					case "userJoined":
					case "userLeft":
						expect(typeof message.name).toBe("string");
						expect(typeof message.userId).toBe("string");
						break;
					case "error":
						expect(typeof message.message).toBe("string");
						break;
				}
			});

			client.close();
		});
	});

	describe("Buffer Mode (msgpack) Integration", () => {
		it("should work with buffer mode and msgpack serialization", async () => {
			const roomId = "test-buffer-mode";
			const api = honoDoFetcherWithName(env.ZOD_CHAT_ROOM, roomId);

			const wsResp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});

			expect(wsResp.status).toBe(101);
			expect(wsResp.webSocket).not.toBeNull();

			if (!wsResp.webSocket) throw new Error("Expected WebSocket");
			const ws = wsResp.webSocket;

			const messages: BufferServerMessage[] = [];

			// Enable buffer messages for msgpack!
			const client = new ZodWebSocketClient({
				webSocket: ws,
				clientSchema: BufferClientMessageSchema,
				serverSchema: BufferServerMessageSchema,
				enableBufferMessages: true, // Use msgpack instead of JSON
				onMessage: (message) => {
					messages.push(message);
				},
			});

			ws.accept();

			// Set name using buffer mode
			const setNameMsg: BufferClientMessage = {
				type: "setName",
				name: "BufferUser",
			};
			client.send(setNameMsg);

			// Wait for nameChanged message
			await vi.waitFor(() => {
				expect(messages.length).toBeGreaterThan(0);
			});

			const nameChanged = messages.find((m) => m.type === "nameChanged");
			expect(nameChanged).toBeDefined();
			if (nameChanged && nameChanged.type === "nameChanged") {
				expect(nameChanged.newName).toBe("BufferUser");
			}

			// Send a chat message using buffer mode
			const chatMsg: BufferClientMessage = {
				type: "message",
				text: "Hello from msgpack!",
			};
			client.send(chatMsg);

			await vi.waitFor(() => {
				expect(
					messages.some(
						(m) => m.type === "message" && m.text === "Hello from msgpack!",
					),
				).toBe(true);
			});

			const receivedMsg = messages.find(
				(m) => m.type === "message" && m.text === "Hello from msgpack!",
			);
			expect(receivedMsg).toBeDefined();

			client.close();
		});

		it("should handle multiple clients in buffer mode", async () => {
			const roomId = "test-buffer-multi-client";
			const api = honoDoFetcherWithName(env.ZOD_CHAT_ROOM, roomId);

			// Client 1
			const ws1Resp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!ws1Resp.webSocket) throw new Error("Expected WebSocket 1");

			const client1Messages: BufferServerMessage[] = [];
			const client1 = new ZodWebSocketClient({
				webSocket: ws1Resp.webSocket,
				clientSchema: BufferClientMessageSchema,
				serverSchema: BufferServerMessageSchema,
				enableBufferMessages: true,
				onMessage: (message) => client1Messages.push(message),
			});
			ws1Resp.webSocket.accept();

			// Client 2
			const ws2Resp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!ws2Resp.webSocket) throw new Error("Expected WebSocket 2");

			const client2Messages: BufferServerMessage[] = [];
			const client2 = new ZodWebSocketClient({
				webSocket: ws2Resp.webSocket,
				clientSchema: BufferClientMessageSchema,
				serverSchema: BufferServerMessageSchema,
				enableBufferMessages: true,
				onMessage: (message) => client2Messages.push(message),
			});
			ws2Resp.webSocket.accept();

			// Client 1 sends a message
			const msg: BufferClientMessage = {
				type: "message",
				text: "Buffer broadcast!",
			};
			client1.send(msg);

			// Both clients should receive it
			await vi.waitFor(() => {
				expect(client1Messages.length).toBeGreaterThan(0);
				expect(client2Messages.length).toBeGreaterThan(0);
			});

			const c1Received = client1Messages.find(
				(m) => m.type === "message" && m.text === "Buffer broadcast!",
			);
			const c2Received = client2Messages.find(
				(m) => m.type === "message" && m.text === "Buffer broadcast!",
			);

			expect(c1Received).toBeDefined();
			expect(c2Received).toBeDefined();

			client1.close();
			client2.close();
		});

		it("should validate buffer messages with Zod schemas", async () => {
			const roomId = "test-buffer-validation";
			const api = honoDoFetcherWithName(env.ZOD_CHAT_ROOM, roomId);

			const wsResp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!wsResp.webSocket) throw new Error("Expected WebSocket");

			const messages: BufferServerMessage[] = [];
			const errors: unknown[] = [];

			const client = new ZodWebSocketClient({
				webSocket: wsResp.webSocket,
				clientSchema: BufferClientMessageSchema,
				serverSchema: BufferServerMessageSchema,
				enableBufferMessages: true,
				onMessage: (message) => messages.push(message),
				onValidationError: (error) => errors.push(error),
			});

			wsResp.webSocket.accept();

			// Send valid message
			const validMsg: BufferClientMessage = {
				type: "setName",
				name: "ValidBufferUser",
			};
			client.send(validMsg);

			await vi.waitFor(() => {
				expect(messages.length).toBeGreaterThan(0);
			});

			const nameChanged = messages.find((m) => m.type === "nameChanged");
			expect(nameChanged).toBeDefined();
			if (nameChanged && nameChanged.type === "nameChanged") {
				expect(nameChanged.newName).toBe("ValidBufferUser");
			}

			// Should have no validation errors
			expect(errors.length).toBe(0);

			client.close();
		});

		it("should handle chat flow in buffer mode", async () => {
			const roomId = "test-buffer-chat-flow";
			const api = honoDoFetcherWithName(env.ZOD_CHAT_ROOM, roomId);

			// Alice connects
			const aliceResp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!aliceResp.webSocket) throw new Error("Expected WebSocket");

			const aliceMessages: BufferServerMessage[] = [];
			const alice = new ZodWebSocketClient({
				webSocket: aliceResp.webSocket,
				clientSchema: BufferClientMessageSchema,
				serverSchema: BufferServerMessageSchema,
				enableBufferMessages: true,
				onMessage: (message) => aliceMessages.push(message),
			});
			aliceResp.webSocket.accept();

			alice.send({
				type: "setName",
				name: "Alice",
			});

			// Bob connects
			const bobResp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});
			if (!bobResp.webSocket) throw new Error("Expected WebSocket");

			const bobMessages: BufferServerMessage[] = [];
			const bob = new ZodWebSocketClient({
				webSocket: bobResp.webSocket,
				clientSchema: BufferClientMessageSchema,
				serverSchema: BufferServerMessageSchema,
				enableBufferMessages: true,
				onMessage: (message) => bobMessages.push(message),
			});
			bobResp.webSocket.accept();

			bob.send({
				type: "setName",
				name: "Bob",
			});

			// Alice sends message
			alice.send({
				type: "message",
				text: "Hi Bob via msgpack!",
			});

			// Wait for Bob to receive it
			await vi.waitFor(() => {
				expect(
					bobMessages.some(
						(m) => m.type === "message" && m.text === "Hi Bob via msgpack!",
					),
				).toBe(true);
			});

			const bobReceivedMsg = bobMessages.find(
				(m) => m.type === "message" && m.text === "Hi Bob via msgpack!",
			);
			expect(bobReceivedMsg).toBeDefined();
			if (bobReceivedMsg && bobReceivedMsg.type === "message") {
				expect(bobReceivedMsg.from).toBe("Alice");
			}

			// Bob replies
			bob.send({
				type: "message",
				text: "Hey Alice, msgpack works!",
			});

			// Wait for Alice to receive it
			await vi.waitFor(() => {
				expect(
					aliceMessages.some(
						(m) =>
							m.type === "message" && m.text === "Hey Alice, msgpack works!",
					),
				).toBe(true);
			});

			const aliceReceivedReply = aliceMessages.find(
				(m) => m.type === "message" && m.text === "Hey Alice, msgpack works!",
			);
			expect(aliceReceivedReply).toBeDefined();
			if (aliceReceivedReply && aliceReceivedReply.type === "message") {
				expect(aliceReceivedReply.from).toBe("Bob");
			}

			// Verify session count via HTTP
			const infoResp = await api.post({ url: "/info" });
			const info = await infoResp.json();
			expect(info.sessionCount).toBe(2);

			alice.close();
			bob.close();
		});
	});
});
