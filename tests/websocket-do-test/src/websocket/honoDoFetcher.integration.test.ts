/**
 * Integration tests for honoDoFetcher with Durable Objects
 *
 * Tests the type-safe DO client creation functions:
 * - honoDoFetcher: Create client from DO stub
 * - honoDoFetcherWithName: Create client with named ID
 * - honoDoFetcherWithId: Create client with string ID
 *
 * Reference: https://github.com/firtoz/router-toolkit/tree/main/packages/hono-fetcher
 */

import { env, SELF } from "cloudflare:test";
import {
	honoDoFetcher,
	honoDoFetcherWithId,
	honoDoFetcherWithName,
} from "@firtoz/hono-fetcher";
import { assert, describe, expect, it } from "vitest";
import "./test-fixtures/worker";
import type { ServerMessage } from "./test-fixtures/ChatRoomDO";

describe("honoDoFetcher Integration Tests", () => {
	describe("honoDoFetcher", () => {
		it("should create type-safe client from DO stub", async () => {
			// Access environment bindings directly

			// Create DO stub using new getByName API (2025+)
			const stub = env.CHAT_ROOM.getByName("test-hono-fetcher");

			// Create typed fetcher
			const api = honoDoFetcher(stub);

			// Make type-safe request to /info endpoint
			const response = await api.post({ url: "/info" });

			expect(response.status).toBe(200);
			const info = await response.json();
			expect(info.sessionCount).toBe(0);
			expect(Array.isArray(info.sessions)).toBe(true);
		});

		it("should handle multiple requests to same DO", async () => {
			const stub = env.CHAT_ROOM.getByName("test-multi");
			const api = honoDoFetcher(stub);

			// First request
			const response1 = await api.post({ url: "/info" });
			expect(response1.status).toBe(200);

			// Second request to same DO
			const response2 = await api.post({ url: "/info" });
			expect(response2.status).toBe(200);

			// Both should work
			const info1 = await response1.json();
			const info2 = await response2.json();
			expect(info1.sessionCount).toBe(info2.sessionCount);
		});
	});

	describe("honoDoFetcherWithName", () => {
		it("should create client with named ID", async () => {
			// Create fetcher directly with name
			const api = honoDoFetcherWithName(env.CHAT_ROOM, "test-with-name");

			const response = await api.post({ url: "/info" });
			expect(response.status).toBe(200);

			const info = await response.json();
			expect(info.sessionCount).toBe(0);
			expect(Array.isArray(info.sessions)).toBe(true);
		});

		it("should route to same DO for same name", async () => {
			const roomName = "test-consistent-name";

			// Create two fetchers with same name
			const api1 = honoDoFetcherWithName(env.CHAT_ROOM, roomName);
			const api2 = honoDoFetcherWithName(env.CHAT_ROOM, roomName);

			// Both should hit the same DO instance
			const response1 = await api1.post({ url: "/info" });
			const response2 = await api2.post({ url: "/info" });

			expect(response1.status).toBe(200);
			expect(response2.status).toBe(200);

			const info1 = await response1.json();
			const info2 = await response2.json();
			expect(info1.sessionCount).toBe(info2.sessionCount);
		});

		it("should isolate different named DOs", async () => {
			const api1 = honoDoFetcherWithName(env.CHAT_ROOM, "room-a");
			const api2 = honoDoFetcherWithName(env.CHAT_ROOM, "room-b");

			const response1 = await api1.post({ url: "/info" });
			const response2 = await api2.post({ url: "/info" });

			// Both should work independently
			expect(response1.status).toBe(200);
			expect(response2.status).toBe(200);

			const info1 = await response1.json();
			const info2 = await response2.json();

			// Both should be independent (0 sessions each)
			expect(info1.sessionCount).toBe(0);
			expect(info2.sessionCount).toBe(0);
		});
	});

	describe("honoDoFetcherWithId", () => {
		it("should create client with string ID", async () => {
			// Generate a valid DO ID by first creating one from name, then converting to string
			const stub = env.CHAT_ROOM.getByName("test-for-string-id");
			const idString = stub.id.toString();

			const api = honoDoFetcherWithId(env.CHAT_ROOM, idString);

			const response = await api.post({ url: "/info" });
			expect(response.status).toBe(200);

			const info = await response.json();
			expect(info.sessionCount).toBe(0);
		});

		it("should route to same DO for same ID", async () => {
			// Generate a valid ID string
			const stub = env.CHAT_ROOM.getByName("test-consistent-id");
			const idString = stub.id.toString();

			const api1 = honoDoFetcherWithId(env.CHAT_ROOM, idString);
			const api2 = honoDoFetcherWithId(env.CHAT_ROOM, idString);

			const response1 = await api1.post({ url: "/info" });
			const response2 = await api2.post({ url: "/info" });

			expect(response1.status).toBe(200);
			expect(response2.status).toBe(200);

			const info1 = await response1.json();
			const info2 = await response2.json();
			expect(info1.sessionCount).toBe(info2.sessionCount);
		});
	});

	describe("Type Safety", () => {
		it("should provide type-safe access to DO endpoints", async () => {
			const api = honoDoFetcherWithName(env.CHAT_ROOM, "test-types");

			// The fetcher should work with the correct endpoint
			const response = await api.post({ url: "/info" });
			expect(response.status).toBe(200);

			// Response is fully typed by the fetcher - no casting needed!
			const info = await response.json();

			expect(typeof info.sessionCount).toBe("number");
			expect(Array.isArray(info.sessions)).toBe(true);

			// TypeScript knows the exact shape of sessions array
			if (info.sessions.length > 0) {
				assert(info.sessions[0]);
				expect(typeof info.sessions[0].userId).toBe("string");
				expect(typeof info.sessions[0].name).toBe("string");
				expect(typeof info.sessions[0].joinedAt).toBe("number");
			}
		});
	});

	describe("Real WebSocket Session Integration", () => {
		it("should show real session data when WebSockets are connected", async () => {
			const roomId = "test-real-sessions";
			const api = honoDoFetcherWithName(env.CHAT_ROOM, roomId);

			// Initially should have no sessions
			let response = await api.post({ url: "/info" });
			let info = await response.json();
			expect(info.sessionCount).toBe(0);
			expect(info.sessions).toHaveLength(0);

			// Connect first WebSocket client
			const wsResp1 = await SELF.fetch(
				`http://example.com/room/${roomId}/websocket`,
				{
					headers: { Upgrade: "websocket" },
				},
			);
			expect(wsResp1.status).toBe(101);
			if (!wsResp1.webSocket) throw new Error("Expected WebSocket");
			const ws1 = wsResp1.webSocket;
			ws1.accept();

			// Give connection time to register
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should now have 1 session
			response = await api.post({ url: "/info" });
			info = await response.json();
			expect(info.sessionCount).toBe(1);
			expect(info.sessions).toHaveLength(1);

			// TypeScript knows the exact shape - no casting needed!
			const session1 = info.sessions[0];
			assert(session1);
			expect(typeof session1.userId).toBe("string");
			expect(typeof session1.name).toBe("string");
			expect(typeof session1.joinedAt).toBe("number");
			expect(session1.name.startsWith("User-")).toBe(true);

			// Connect second WebSocket client
			const wsResp2 = await SELF.fetch(
				`http://example.com/room/${roomId}/websocket`,
				{
					headers: { Upgrade: "websocket" },
				},
			);
			expect(wsResp2.status).toBe(101);
			if (!wsResp2.webSocket) throw new Error("Expected WebSocket");
			const ws2 = wsResp2.webSocket;
			ws2.accept();

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should now have 2 sessions
			response = await api.post({ url: "/info" });
			info = await response.json();
			expect(info.sessionCount).toBe(2);
			expect(info.sessions).toHaveLength(2);

			// Each session should have unique userId
			const userIds = info.sessions.map((s) => s.userId);
			expect(new Set(userIds).size).toBe(2); // All unique

			// Close first connection
			ws1.close();
			await new Promise((resolve) => setTimeout(resolve, 100)); // Give time for cleanup

			// Should now have 1 session again
			response = await api.post({ url: "/info" });
			info = await response.json();
			expect(info.sessionCount).toBe(1);
			expect(info.sessions).toHaveLength(1);

			// The remaining session should be the second one
			assert(info.sessions[0]);
			expect(info.sessions[0].userId).not.toBe(session1.userId);

			// Close second connection
			ws2.close();
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should be back to 0 sessions
			response = await api.post({ url: "/info" });
			info = await response.json();
			expect(info.sessionCount).toBe(0);
			expect(info.sessions).toHaveLength(0);
		});

		it("should show updated session names when changed via WebSocket", async () => {
			const roomId = "test-name-changes";
			const api = honoDoFetcherWithName(env.CHAT_ROOM, roomId);

			// Connect WebSocket
			const wsResp = await SELF.fetch(
				`http://example.com/room/${roomId}/websocket`,
				{
					headers: { Upgrade: "websocket" },
				},
			);
			if (!wsResp.webSocket) throw new Error("Expected WebSocket");
			const ws = wsResp.webSocket;
			ws.accept();

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Check initial session data
			let response = await api.post({ url: "/info" });
			let info = await response.json();
			expect(info.sessionCount).toBe(1);
			assert(info.sessions[0]);
			const originalName = info.sessions[0].name;
			const userId = info.sessions[0].userId;

			// Change name via WebSocket
			ws.send(JSON.stringify({ type: "setName", name: "Alice" }));
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Check updated session data
			response = await api.post({ url: "/info" });
			info = await response.json();
			expect(info.sessionCount).toBe(1);
			assert(info.sessions[0]);
			expect(info.sessions[0].userId).toBe(userId); // Same user
			expect(info.sessions[0].name).toBe("Alice"); // Updated name
			expect(info.sessions[0].name).not.toBe(originalName);

			ws.close();
		});
	});

	describe("WebSocket Connection via honoDoFetcher", () => {
		it("should support WebSocket connections via honoDoFetcher.websocket()", async () => {
			const roomId = "test-websocket-via-fetcher";
			const api = honoDoFetcherWithName(env.CHAT_ROOM, roomId);

			// Use the new websocket method on the fetcher
			// WebSocket is auto-accepted by default for convenience
			const wsResp = await api.websocket({ url: "/websocket" });

			// Should get a WebSocket upgrade response
			expect(wsResp.status).toBe(101);
			expect(wsResp.webSocket).not.toBeNull();

			if (!wsResp.webSocket) throw new Error("Expected WebSocket");
			const ws = wsResp.webSocket;
			// No need to call ws.accept() - it's done automatically!

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Verify the session was created
			const infoResp = await api.post({ url: "/info" });
			const info = await infoResp.json();
			expect(info.sessionCount).toBe(1);

			ws.close();
		});

		it("should support multiple WebSocket connections via honoDoFetcher", async () => {
			const roomId = "test-multi-websocket-via-fetcher";
			const api = honoDoFetcherWithName(env.CHAT_ROOM, roomId);

			// Connect first WebSocket via fetcher (auto-accepted)
			const wsResp1 = await api.websocket({ url: "/websocket" });
			expect(wsResp1.status).toBe(101);
			if (!wsResp1.webSocket) throw new Error("Expected WebSocket 1");
			const ws1 = wsResp1.webSocket;

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Connect second WebSocket via fetcher (auto-accepted)
			const wsResp2 = await api.websocket({ url: "/websocket" });
			expect(wsResp2.status).toBe(101);
			if (!wsResp2.webSocket) throw new Error("Expected WebSocket 2");
			const ws2 = wsResp2.webSocket;

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should have 2 sessions
			const infoResp = await api.post({ url: "/info" });
			const info = await infoResp.json();
			expect(info.sessionCount).toBe(2);

			ws1.close();
			ws2.close();
		});

		it("should support sending/receiving messages via honoDoFetcher websocket", async () => {
			const roomId = "test-messages-via-fetcher";
			const api = honoDoFetcherWithName(env.CHAT_ROOM, roomId);

			// Connect WebSocket via fetcher (auto-accepted)
			const wsResp = await api.websocket({ url: "/websocket" });
			expect(wsResp.status).toBe(101);
			if (!wsResp.webSocket) throw new Error("Expected WebSocket");
			const ws = wsResp.webSocket;

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Set up message handler
			const messages: ServerMessage[] = [];
			ws.addEventListener("message", (event) => {
				messages.push(JSON.parse(event.data as string));
			});

			// Change name
			ws.send(JSON.stringify({ type: "setName", name: "Bob" }));

			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should have received nameChanged message
			expect(messages.length).toBeGreaterThan(0);
			const nameChangedMsg = messages.find((m) => m.type === "nameChanged");
			expect(nameChangedMsg).toBeDefined();
			if (nameChangedMsg) {
				expect(nameChangedMsg.newName).toBe("Bob");
			}

			// Verify via API
			const infoResp = await api.post({ url: "/info" });
			const info = await infoResp.json();
			expect(info.sessionCount).toBe(1);
			assert(info.sessions[0]);
			expect(info.sessions[0].name).toBe("Bob");

			ws.close();
		});

		it("should work with honoDoFetcher (stub-based)", async () => {
			// Create a DO stub directly
			const stub = env.CHAT_ROOM.getByName("test-stub-websocket");
			const api = honoDoFetcher(stub);

			// Use websocket method (auto-accepted)
			const wsResp = await api.websocket({ url: "/websocket" });
			expect(wsResp.status).toBe(101);
			expect(wsResp.webSocket).not.toBeNull();

			if (!wsResp.webSocket) throw new Error("Expected WebSocket");
			const ws = wsResp.webSocket;

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Verify session via POST
			const infoResp = await api.post({ url: "/info" });
			const info = await infoResp.json();
			expect(info.sessionCount).toBe(1);

			ws.close();
		});

		it("should work with honoDoFetcherWithId", async () => {
			// Get a valid ID
			const stub = env.CHAT_ROOM.getByName("test-id-websocket");
			const idString = stub.id.toString();

			const api = honoDoFetcherWithId(env.CHAT_ROOM, idString);

			// Use websocket method (auto-accepted)
			const wsResp = await api.websocket({ url: "/websocket" });
			expect(wsResp.status).toBe(101);
			expect(wsResp.webSocket).not.toBeNull();

			if (!wsResp.webSocket) throw new Error("Expected WebSocket");
			const ws = wsResp.webSocket;

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Verify session
			const infoResp = await api.post({ url: "/info" });
			const info = await infoResp.json();
			expect(info.sessionCount).toBe(1);

			ws.close();
		});

		it("should allow manual accept when autoAccept is false", async () => {
			const roomId = "test-manual-accept";
			const api = honoDoFetcherWithName(env.CHAT_ROOM, roomId);

			// Disable auto-accept for manual control
			const wsResp = await api.websocket({
				url: "/websocket",
				config: { autoAccept: false },
			});

			expect(wsResp.status).toBe(101);
			expect(wsResp.webSocket).not.toBeNull();

			if (!wsResp.webSocket) throw new Error("Expected WebSocket");
			const ws = wsResp.webSocket;

			// Manually accept when ready
			ws.accept();

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should work just like auto-accept
			const infoResp = await api.post({ url: "/info" });
			const info = await infoResp.json();
			expect(info.sessionCount).toBe(1);

			ws.close();
		});
	});
});
