/**
 * Integration tests for BaseWebSocketDO using @cloudflare/vitest-pool-workers
 *
 * Key concepts demonstrated:
 * 1. Using SELF from cloudflare:test for integration testing
 *    Reference: https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/
 *
 * 2. WebSocket testing with vitest-pool-workers (unlike unstable_dev, this works!)
 *    Reference: https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-from-unstable-dev/
 *
 * 3. Testing Durable Objects with proper isolation
 *    Reference: https://github.com/cloudflare/workers-sdk/tree/main/fixtures/vitest-pool-workers-examples/durable-objects
 */

import { SELF } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "./test-fixtures/ChatRoomDO";

// IMPORTANT: This import loads the worker module into the test environment
// Without this, SELF won't know what to route to
// Reference: https://developers.cloudflare.com/workers/testing/vitest-integration/get-started/
import "./test-fixtures/worker";

describe("BaseWebSocketDO Integration Tests", () => {
	it("should return worker info on root path", async () => {
		const resp = await SELF.fetch("http://example.com/");
		expect(resp.status).toBe(200);
		const text = await resp.text();
		expect(text).toBe("WebSocket DO Test Worker");
	});

	describe("Durable Object Routing", () => {
		it("should reject non-WebSocket requests to /websocket endpoint", async () => {
			const roomId = "test-room-1";
			const resp = await SELF.fetch(
				`http://example.com/room/${roomId}/websocket`,
			);

			expect(resp.status).toBe(400);
			const text = await resp.text();
			expect(text).toBe("Expected websocket");
		});

		it("should respond to /info endpoint on the DO", async () => {
			const roomId = "test-room-info";
			const resp = await SELF.fetch(`http://example.com/room/${roomId}/info`, {
				method: "POST",
			});

			expect(resp.status).toBe(200);
			const info = (await resp.json()) as {
				sessionCount: number;
				sessions: unknown[];
			};
			expect(info).toHaveProperty("sessionCount");
			expect(info).toHaveProperty("sessions");
			expect(info.sessionCount).toBe(0);
			expect(Array.isArray(info.sessions)).toBe(true);
		});
	});

	describe("Multiple Room Isolation", () => {
		it("should isolate DOs by room ID", async () => {
			const roomId1 = `test-room-${Date.now()}-a`;
			const roomId2 = `test-room-${Date.now()}-b`;

			// Each room should have its own DO instance and independent state
			const resp1 = await SELF.fetch(
				`http://example.com/room/${roomId1}/info`,
				{
					method: "POST",
				},
			);
			const info1 = (await resp1.json()) as { sessionCount: number };
			expect(info1.sessionCount).toBe(0);

			const resp2 = await SELF.fetch(
				`http://example.com/room/${roomId2}/info`,
				{
					method: "POST",
				},
			);
			const info2 = (await resp2.json()) as { sessionCount: number };
			expect(info2.sessionCount).toBe(0);

			// Both should be independent - this verifies DO isolation
			expect(resp1.status).toBe(200);
			expect(resp2.status).toBe(200);
		});

		it("should route to same DO instance for same room ID", async () => {
			const roomId = `test-room-${Date.now()}-consistent`;

			// Multiple requests to same room should hit same DO
			const resp1 = await SELF.fetch(`http://example.com/room/${roomId}/info`, {
				method: "POST",
			});
			expect(resp1.status).toBe(200);

			const resp2 = await SELF.fetch(`http://example.com/room/${roomId}/info`, {
				method: "POST",
			});
			expect(resp2.status).toBe(200);

			// State should be consistent (both show 0 sessions since we're not connecting)
			const info1 = (await resp1.json()) as { sessionCount: number };
			const info2 = (await resp2.json()) as { sessionCount: number };
			expect(info1.sessionCount).toBe(info2.sessionCount);
		});
	});

	describe("WebSocket Testing with vitest-pool-workers", () => {
		it("should establish WebSocket connection", async () => {
			const roomId = "test-ws-connection";

			// WebSocket upgrade via SELF.fetch - this returns a Response with a webSocket property
			// Unlike unstable_dev which fails with "invalid upgrade header", vitest-pool-workers
			// properly handles WebSocket upgrades
			// Reference: https://developers.cloudflare.com/workers/runtime-apis/websockets/
			const resp = await SELF.fetch(
				`http://example.com/room/${roomId}/websocket`,
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);

			// Status 101 = Switching Protocols (WebSocket upgrade successful)
			expect(resp.status).toBe(101);
			expect(resp.webSocket).toBeDefined();
		});

		it("should send and receive chat messages", async () => {
			const roomId = "test-ws-chat";

			// Connect first client
			const resp1 = await SELF.fetch(
				`http://example.com/room/${roomId}/websocket`,
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);
			if (!resp1.webSocket) throw new Error("Expected WebSocket");
			const ws1 = resp1.webSocket;

			// IMPORTANT: Must call accept() before using the WebSocket
			// This is specific to Cloudflare's WebSocket API
			// Reference: https://developers.cloudflare.com/workers/runtime-apis/websockets/
			ws1.accept();

			// Connect second client to the same room (same DO instance)
			const resp2 = await SELF.fetch(
				`http://example.com/room/${roomId}/websocket`,
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);
			if (!resp2.webSocket) throw new Error("Expected WebSocket");
			const ws2 = resp2.webSocket;
			ws2.accept();

			// Set up message listener on second client
			const messages: ServerMessage[] = [];
			ws2.addEventListener("message", (event) => {
				messages.push(JSON.parse(event.data as string) as ServerMessage);
			});

			// Give connections time to establish with the DO
			// WebSocket connections are asynchronous, need time to register
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Send message from first client
			ws1.send(
				JSON.stringify({ type: "message", text: "Hello from client 1!" }),
			);

			// Wait for the specific message to arrive
			await vi.waitFor(
				() => {
					expect(
						messages.some(
							(m) => m.type === "message" && m.text === "Hello from client 1!",
						),
					).toBe(true);
				},
				{ timeout: 1000, interval: 20 },
			);

			const chatMessage = messages.find(
				(m): m is Extract<ServerMessage, { type: "message" }> =>
					m.type === "message" && m.text === "Hello from client 1!",
			);
			expect(chatMessage).toBeDefined();

			ws1.close();
			ws2.close();
		});

		it("should handle name changes", async () => {
			const roomId = "test-ws-names";

			const resp1 = await SELF.fetch(
				`http://example.com/room/${roomId}/websocket`,
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);
			if (!resp1.webSocket) throw new Error("Expected WebSocket");
			const ws1 = resp1.webSocket;
			ws1.accept();

			const resp2 = await SELF.fetch(
				`http://example.com/room/${roomId}/websocket`,
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);
			if (!resp2.webSocket) throw new Error("Expected WebSocket");
			const ws2 = resp2.webSocket;
			ws2.accept();

			const messages: ServerMessage[] = [];
			ws2.addEventListener("message", (event) => {
				messages.push(JSON.parse(event.data as string) as ServerMessage);
			});

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Change name on first client
			ws1.send(JSON.stringify({ type: "setName", name: "Alice" }));

			// Wait for nameChanged message to arrive
			await vi.waitFor(
				() => {
					expect(messages.some((m) => m.type === "nameChanged")).toBe(true);
				},
				{ timeout: 1000, interval: 20 },
			);

			// Should have received name change broadcast
			const nameChange = messages.find(
				(m): m is Extract<ServerMessage, { type: "nameChanged" }> =>
					m.type === "nameChanged",
			);
			expect(nameChange).toBeDefined();
			expect(nameChange?.newName).toBe("Alice");

			ws1.close();
			ws2.close();
		});

		it("should isolate messages between different rooms", async () => {
			const roomId1 = "test-ws-room-a";
			const roomId2 = "test-ws-room-b";

			// Connect to room 1 - this creates a separate DO instance for roomId1
			// DO isolation is achieved via idFromName() which deterministically
			// maps room IDs to unique DO instances
			// Reference: https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-from-a-worker/#generating-ids-by-name
			const resp1 = await SELF.fetch(
				`http://example.com/room/${roomId1}/websocket`,
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);
			if (!resp1.webSocket) throw new Error("Expected WebSocket");
			const ws1 = resp1.webSocket;
			ws1.accept();

			// Connect to room 2 - this creates a DIFFERENT DO instance for roomId2
			const resp2 = await SELF.fetch(
				`http://example.com/room/${roomId2}/websocket`,
				{
					headers: {
						Upgrade: "websocket",
					},
				},
			);
			if (!resp2.webSocket) throw new Error("Expected WebSocket");
			const ws2 = resp2.webSocket;
			ws2.accept();

			const room1Messages: ServerMessage[] = [];
			const room2Messages: ServerMessage[] = [];

			ws1.addEventListener("message", (event) => {
				room1Messages.push(JSON.parse(event.data as string) as ServerMessage);
			});

			ws2.addEventListener("message", (event) => {
				room2Messages.push(JSON.parse(event.data as string) as ServerMessage);
			});

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Send message in room 1
			ws1.send(JSON.stringify({ type: "message", text: "Room 1 message" }));

			// Send message in room 2
			ws2.send(JSON.stringify({ type: "message", text: "Room 2 message" }));

			// Wait for both messages to be received by their respective rooms
			await vi.waitFor(
				() => {
					const room1HasOwnMsg = room1Messages.some(
						(m) => m.type === "message" && m.text === "Room 1 message",
					);
					const room2HasOwnMsg = room2Messages.some(
						(m) => m.type === "message" && m.text === "Room 2 message",
					);
					expect(room1HasOwnMsg && room2HasOwnMsg).toBe(true);
				},
				{ timeout: 1000, interval: 20 },
			);

			// Verify messages didn't cross rooms - this confirms DO isolation works
			// Each DO instance maintains its own sessions Map and only broadcasts
			// to sessions within that instance
			const room1HasRoom2Msg = room1Messages.some(
				(m): m is Extract<ServerMessage, { type: "message" }> =>
					m.type === "message" && m.text === "Room 2 message",
			);
			const room2HasRoom1Msg = room2Messages.some(
				(m): m is Extract<ServerMessage, { type: "message" }> =>
					m.type === "message" && m.text === "Room 1 message",
			);

			expect(room1HasRoom2Msg).toBe(false);
			expect(room2HasRoom1Msg).toBe(false);

			ws1.close();
			ws2.close();
		});
	});
});
