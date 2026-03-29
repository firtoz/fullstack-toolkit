import type { SyncMessage } from "@firtoz/db-helpers";
import { describe, expect, it } from "bun:test";
import { SyncClientBridge } from "./sync-client-bridge";
import { DEFAULT_SYNC_COLLECTION_ID } from "./sync-protocol";

type Item = { id: string; title: string; updatedAt: number };

describe("SyncClientBridge", () => {
	it("does not send syncHello when sendSyncHelloOnConnect is false", () => {
		const sent: unknown[] = [];
		const bridge = new SyncClientBridge<Item>({
			clientId: "c1",
			send: (msg) => sent.push(msg),
			sendSyncHelloOnConnect: false,
			collection: {
				utils: {
					receiveSync: async () => {},
				},
			},
		});
		bridge.setConnected(true);
		expect(sent.length).toBe(0);
	});

	it("sends update and clears pending on ack", async () => {
		const sent: unknown[] = [];
		const received: unknown[] = [];
		const bridge = new SyncClientBridge<Item>({
			clientId: "c1",
			send: (msg) => sent.push(msg),
			collection: {
				utils: {
					receiveSync: async (messages) => {
						received.push(messages);
					},
				},
			},
		});
		bridge.setConnected(true);

		const mutationId = bridge.sendUpdate(
			{ id: "1", title: "new", updatedAt: 2 },
			{ id: "1", title: "old", updatedAt: 1 },
		);
		expect(bridge.pendingCount).toBe(1);

		await bridge.handleServerMessage({
			type: "ack",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "c1",
			clientMutationIds: [mutationId],
			serverVersion: 1,
			changes: [
				{
					type: "update",
					value: { id: "1", title: "new", updatedAt: 2 },
					previousValue: { id: "1", title: "old", updatedAt: 1 },
				},
			],
		});

		expect(sent.length).toBe(2);
		expect(received.length).toBe(1);
		expect(bridge.pendingCount).toBe(0);
	});

	it("coerces ack insert to update when setRowGet finds an existing row", async () => {
		const received: SyncMessage<Item>[][] = [];
		const local: Item = { id: "a", title: "local", updatedAt: 1 };
		const bridge = new SyncClientBridge<Item>({
			clientId: "c1",
			send: () => {},
			collection: {
				utils: {
					receiveSync: async (messages) => {
						received.push(messages);
					},
				},
			},
		});
		bridge.setRowGet((key) => (String(key) === "a" ? local : undefined));
		bridge.setConnected(true);

		await bridge.handleServerMessage({
			type: "ack",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "c1",
			clientMutationIds: [],
			serverVersion: 1,
			changes: [
				{
					type: "insert",
					value: { id: "a", title: "server", updatedAt: 2 },
				},
			],
		});

		expect(received.length).toBe(1);
		const batch = received[0];
		expect(batch?.length).toBe(1);
		const ch = batch?.[0];
		expect(ch?.type).toBe("update");
		if (ch?.type === "update") {
			expect(ch.value.title).toBe("server");
			expect(ch.previousValue).toEqual(local);
		}
	});

	it("applies snapshot backfill with truncate then changes", async () => {
		const received: unknown[] = [];
		const bridge = new SyncClientBridge<Item>({
			clientId: "c1",
			send: () => {},
			collection: {
				utils: {
					receiveSync: async (messages) => {
						received.push(messages);
					},
				},
			},
		});
		bridge.setConnected(false);

		await bridge.handleServerMessage({
			type: "syncBackfill",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			mode: "snapshot",
			serverVersion: 1,
			changes: [
				{ type: "insert", value: { id: "1", title: "only", updatedAt: 1 } },
			],
			chunkIndex: 0,
			totalChunks: 1,
		});

		expect(received).toEqual([
			[
				{ type: "truncate" },
				{ type: "insert", value: { id: "1", title: "only", updatedAt: 1 } },
			],
		]);
	});

	it("applies delta backfill without truncate", async () => {
		const received: unknown[] = [];
		const bridge = new SyncClientBridge<Item>({
			clientId: "c1",
			send: () => {},
			collection: {
				utils: {
					receiveSync: async (messages) => {
						received.push(messages);
					},
				},
			},
		});
		bridge.setConnected(false);

		await bridge.handleServerMessage({
			type: "syncBackfill",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			mode: "delta",
			serverVersion: 2,
			changes: [
				{ type: "insert", value: { id: "2", title: "x", updatedAt: 2 } },
			],
			chunkIndex: 0,
			totalChunks: 1,
		});

		expect(received).toEqual([
			[{ type: "insert", value: { id: "2", title: "x", updatedAt: 2 } }],
		]);
	});

	it("snapshot backfill with empty changes still truncates stale local rows", async () => {
		const received: unknown[] = [];
		const bridge = new SyncClientBridge<Item>({
			clientId: "c1",
			send: () => {},
			collection: {
				utils: {
					receiveSync: async (messages) => {
						received.push(messages);
					},
				},
			},
		});
		bridge.setConnected(false);

		await bridge.handleServerMessage({
			type: "syncBackfill",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			mode: "snapshot",
			serverVersion: 3,
			changes: [],
			chunkIndex: 0,
			totalChunks: 1,
		});

		expect(received).toEqual([[{ type: "truncate" }]]);
	});

	it("applies chunked snapshot with single truncate and pending replay at end", async () => {
		const sent: unknown[] = [];
		const received: unknown[] = [];
		const bridge = new SyncClientBridge<Item>({
			clientId: "c1",
			send: (msg) => sent.push(msg),
			collection: {
				utils: {
					receiveSync: async (messages) => {
						received.push(messages);
					},
				},
			},
		});
		bridge.setConnected(true);
		bridge.sendInsert({ id: "local", title: "pending", updatedAt: 10 });

		await bridge.handleServerMessage({
			type: "syncBackfill",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			mode: "snapshot",
			serverVersion: 5,
			changes: [
				{ type: "insert", value: { id: "1", title: "a", updatedAt: 1 } },
			],
			chunkIndex: 0,
			totalChunks: 2,
		});
		await bridge.handleServerMessage({
			type: "syncBackfill",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			mode: "snapshot",
			serverVersion: 5,
			changes: [
				{ type: "insert", value: { id: "2", title: "b", updatedAt: 2 } },
			],
			chunkIndex: 1,
			totalChunks: 2,
		});

		expect(received).toEqual([
			[
				{ type: "truncate" },
				{ type: "insert", value: { id: "1", title: "a", updatedAt: 1 } },
			],
			[{ type: "insert", value: { id: "2", title: "b", updatedAt: 2 } }],
		]);

		const mutateBatchMessages = sent.filter(
			(msg) =>
				typeof msg === "object" &&
				msg !== null &&
				(msg as { type?: string }).type === "mutateBatch",
		);
		expect(mutateBatchMessages.length).toBe(2);
	});
});
