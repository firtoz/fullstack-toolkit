import { describe, expect, it } from "bun:test";
import type { SyncMessage } from "@firtoz/db-helpers";
import { PartialSyncClientBridge } from "./partial-sync-client-bridge";
import type { PartialSyncRowShape } from "./partial-sync-row-key";
import { DEFAULT_SYNC_COLLECTION_ID } from "./sync-protocol";

type Item = PartialSyncRowShape & { name: string; age: number };

function item(
	picks: { id: string; name: string; age: number; updatedAt?: number },
): Item {
	return { ...picks, updatedAt: picks.updatedAt ?? 0 };
}

describe("PartialSyncClientBridge", () => {
	it("seedHydratedLocalRows merges local rows into cachedCount without receiveSync", () => {
		const bridge = new PartialSyncClientBridge<Item>({
			clientId: "c1",
			send: () => {},
			collection: {
				utils: {
					receiveSync: async () => {},
				},
			},
		});
		bridge.setConnected(true);
		expect(bridge.cachedCount).toBe(0);
		bridge.seedHydratedLocalRows([
			item({ id: "a", name: "x", age: 1 }),
			item({ id: "b", name: "y", age: 2 }),
		]);
		expect(bridge.cachedCount).toBe(2);
	});

	it("requests range and resolves after final chunk", async () => {
		const sent: unknown[] = [];
		const received: unknown[] = [];
		const states: string[] = [];
		const bridge = new PartialSyncClientBridge<Item>({
			clientId: "c1",
			send: (msg) => sent.push(msg),
			collection: {
				utils: {
					receiveSync: async (messages) => {
						received.push(messages);
					},
				},
			},
			onStateChange: (state) => states.push(state.status),
		});

		bridge.setConnected(true);
		const rangePromise = bridge.requestRange(
			{ column: "name", direction: "asc" },
			2,
			null,
		);
		expect(sent.length).toBe(1);
		expect((sent[0] as { type: string }).type).toBe("queryRange");

		await bridge.handleServerMessage({
			type: "queryRangeChunk",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			requestId: (sent[0] as { requestId: string }).requestId,
			rows: [item({ id: "1", name: "aaaaa", age: 20 })],
			totalCount: 3,
			lastCursor: "aaaaa",
			hasMore: true,
			chunkIndex: 0,
			done: false,
		});
		await bridge.handleServerMessage({
			type: "queryRangeChunk",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			requestId: (sent[0] as { requestId: string }).requestId,
			rows: [item({ id: "2", name: "aaaab", age: 21 })],
			totalCount: 3,
			lastCursor: "aaaab",
			hasMore: true,
			chunkIndex: 1,
			done: true,
		});

		const result = await rangePromise;
		expect(result.rows.length).toBe(2);
		expect(result.totalCount).toBe(3);
		expect(bridge.cachedCount).toBe(2);
		expect([...bridge.serverConfirmedKeys].sort()).toEqual(["1", "2"]);
		expect(bridge.serverConfirmedKeysRevision).toBeGreaterThan(0);
		expect(received.length).toBe(2);
		expect(states.includes("fetching")).toBe(true);
		expect(states.includes("realtime")).toBe(true);
	});

	it("reconciles queryRangeChunk against seeded ids with update when get shows stale local row", async () => {
		const stale = item({ id: "1", name: "local", age: 1, updatedAt: 1 });
		const serverRow = item({ id: "1", name: "server", age: 42, updatedAt: 2 });
		const sent: unknown[] = [];
		const received: SyncMessage<Item>[][] = [];
		const bridge = new PartialSyncClientBridge<Item>({
			clientId: "c1",
			send: (msg) => sent.push(msg),
			collection: {
				get: (key) => (String(key) === "1" ? stale : undefined),
				utils: {
					receiveSync: async (messages) => {
						received.push(messages);
					},
				},
			},
		});

		bridge.setConnected(true);
		bridge.seedHydratedLocalRows([stale]);
		const rangePromise = bridge.requestRange(
			{ column: "name", direction: "asc" },
			1,
			null,
		);
		const requestId = (sent[0] as { requestId: string }).requestId;
		await bridge.handleServerMessage({
			type: "queryRangeChunk",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			requestId,
			rows: [serverRow],
			totalCount: 1,
			lastCursor: "server",
			hasMore: false,
			chunkIndex: 0,
			done: true,
		});
		await rangePromise;

		const updates = received.flatMap((batch) =>
			batch.filter((m) => m.type === "update"),
		);
		expect(updates).toEqual([
			{
				type: "update",
				value: serverRow,
				previousValue: stale,
			},
		]);
	});

	it("skips receiveSync insert for row ids already tracked (overlap / re-fetch)", async () => {
		const sent: unknown[] = [];
		const received: SyncMessage<Item>[][] = [];
		const bridge = new PartialSyncClientBridge<Item>({
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
		const p1 = bridge.requestRange(
			{ column: "name", direction: "asc" },
			2,
			null,
		);
		const id1 = (sent[0] as { requestId: string }).requestId;
		await bridge.handleServerMessage({
			type: "queryRangeChunk",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			requestId: id1,
			rows: [
				item({ id: "1", name: "a", age: 1 }),
				item({ id: "2", name: "b", age: 2 }),
			],
			totalCount: 10,
			lastCursor: "b",
			hasMore: true,
			chunkIndex: 0,
			done: true,
		});
		await p1;

		const p2 = bridge.requestRange(
			{ column: "name", direction: "asc" },
			2,
			"b",
		);
		const id2 = (sent[1] as { requestId: string }).requestId;
		await bridge.handleServerMessage({
			type: "queryRangeChunk",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			requestId: id2,
			rows: [
				item({ id: "2", name: "b", age: 2 }),
				item({ id: "3", name: "c", age: 3 }),
			],
			totalCount: 10,
			lastCursor: "c",
			hasMore: true,
			chunkIndex: 0,
			done: true,
		});
		await p2;

		const insertedIds = received.flatMap((batch) =>
			batch.filter((m) => m.type === "insert").map((m) => m.value.id),
		);
		expect(insertedIds).toEqual(["1", "2", "3"]);
	});

	it("requestByOffset sends queryByOffset and resolves after final chunk", async () => {
		const sent: unknown[] = [];
		const bridge = new PartialSyncClientBridge<Item>({
			clientId: "c1",
			send: (msg) => sent.push(msg),
			collection: {
				utils: {
					receiveSync: async () => {},
				},
			},
		});

		bridge.setConnected(true);
		const rangePromise = bridge.requestByOffset(
			{ column: "name", direction: "asc" },
			2,
			100,
		);
		expect(sent.length).toBe(1);
		expect((sent[0] as { type: string }).type).toBe("queryByOffset");
		expect((sent[0] as { offset: number }).offset).toBe(100);

		await bridge.handleServerMessage({
			type: "queryRangeChunk",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			requestId: (sent[0] as { requestId: string }).requestId,
			rows: [
				item({ id: "1", name: "aaaaa", age: 20 }),
				item({ id: "2", name: "aaaab", age: 21 }),
			],
			totalCount: 500,
			lastCursor: "aaaab",
			hasMore: false,
			chunkIndex: 0,
			done: true,
		});

		const result = await rangePromise;
		expect(result.rows.length).toBe(2);
		expect(result.totalCount).toBe(500);
		expect(result.lastCursor).toBe("aaaab");
	});

	it("enterView rangePatch inserts when row not cached", async () => {
		const received: SyncMessage<Item>[][] = [];
		const bridge = new PartialSyncClientBridge<Item>({
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

		const update: SyncMessage<Item> = {
			type: "update",
			value: item({ id: "1", name: "new", age: 30 }),
			previousValue: item({ id: "1", name: "old", age: 20 }),
		};
		await bridge.handleServerMessage({
			type: "rangePatch",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			change: update,
			viewTransition: "enterView",
		});

		expect(received).toEqual([
			[{ type: "insert", value: item({ id: "1", name: "new", age: 30 }) }],
		]);
		expect(bridge.cachedCount).toBe(1);
	});

	it("enterView rangePatch updates when row already cached", async () => {
		const received: SyncMessage<Item>[][] = [];
		const bridge = new PartialSyncClientBridge<Item>({
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

		await bridge.handleServerMessage({
			type: "rangePatch",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			change: {
				type: "insert",
				value: item({ id: "1", name: "a", age: 1 }),
			},
		});
		const update: SyncMessage<Item> = {
			type: "update",
			value: item({ id: "1", name: "b", age: 2 }),
			previousValue: item({ id: "1", name: "a", age: 1 }),
		};
		await bridge.handleServerMessage({
			type: "rangePatch",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			change: update,
			viewTransition: "enterView",
		});

		expect(received[1]).toEqual([update]);
	});

	it("exitView rangePatch applies update and invokes onViewTransition", async () => {
		const received: SyncMessage<Item>[][] = [];
		const transitions: { type: string; change: SyncMessage<Item> }[] = [];
		const bridge = new PartialSyncClientBridge<Item>({
			clientId: "c1",
			send: () => {},
			collection: {
				utils: {
					receiveSync: async (messages) => {
						received.push(messages);
					},
				},
			},
			onViewTransition: (e) => transitions.push(e),
		});

		await bridge.handleServerMessage({
			type: "rangePatch",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			change: {
				type: "insert",
				value: item({ id: "1", name: "a", age: 1 }),
			},
		});
		const update: SyncMessage<Item> = {
			type: "update",
			value: item({ id: "1", name: "z", age: 99 }),
			previousValue: item({ id: "1", name: "a", age: 1 }),
		};
		await bridge.handleServerMessage({
			type: "rangePatch",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			change: update,
			viewTransition: "exitView",
		});

		expect(transitions).toEqual([{ type: "exitView", change: update }]);
		expect(received[1]).toEqual([update]);
		expect(bridge.cachedCount).toBe(1);
	});

	it("applies range patches to local cache", async () => {
		const received: unknown[] = [];
		const bridge = new PartialSyncClientBridge<Item>({
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

		await bridge.handleServerMessage({
			type: "rangePatch",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			change: {
				type: "insert",
				value: item({ id: "1", name: "aaaaa", age: 20 }),
			},
		});
		await bridge.handleServerMessage({
			type: "rangePatch",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			change: {
				type: "delete",
				key: "1",
			},
		});

		expect(received).toEqual([
			[{ type: "insert", value: item({ id: "1", name: "aaaaa", age: 20 }) }],
			[{ type: "delete", key: "1" }],
		]);
		expect(bridge.cachedCount).toBe(0);
	});

	it("requestRangeQuery resolves on rangeUpToDate without receiveSync", async () => {
		const sent: unknown[] = [];
		const received: SyncMessage<Item>[][] = [];
		const bridge = new PartialSyncClientBridge<Item>({
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
		const p = bridge.requestRangeQuery(
			{
				kind: "index",
				mode: "offset",
				sort: { column: "name", direction: "asc" },
				limit: 5,
				offset: 0,
			},
			{ version: 1, count: 5 },
		);
		const requestId = (sent[0] as { requestId: string }).requestId;
		await bridge.handleServerMessage({
			type: "rangeUpToDate",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			requestId,
			totalCount: 99,
		});
		const result = await p;
		expect(result.upToDate).toBe(true);
		expect(result.totalCount).toBe(99);
		expect(received.length).toBe(0);
	});

	it("requestRangeQuery applies rangeDelta via receiveSync", async () => {
		const sent: unknown[] = [];
		const received: SyncMessage<Item>[][] = [];
		const bridge = new PartialSyncClientBridge<Item>({
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
		const p = bridge.requestRangeQuery({
			kind: "index",
			mode: "offset",
			sort: { column: "name", direction: "asc" },
			limit: 5,
			offset: 0,
		});
		const requestId = (sent[0] as { requestId: string }).requestId;
		await bridge.handleServerMessage({
			type: "rangeDelta",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			requestId,
			totalCount: 10,
			changes: [{ type: "insert", value: item({ id: "9", name: "z", age: 9 }) }],
			lastCursor: null,
		});
		const result = await p;
		expect(result.invalidateWindow).toBe(true);
		expect(received).toEqual([
			[{ type: "insert", value: item({ id: "9", name: "z", age: 9 }) }],
		]);
	});

	it("requestRangeQuery full fetch uses queryRangeChunk path", async () => {
		const sent: unknown[] = [];
		const bridge = new PartialSyncClientBridge<Item>({
			clientId: "c1",
			send: (msg) => sent.push(msg),
			collection: {
				utils: {
					receiveSync: async () => {},
				},
			},
		});

		bridge.setConnected(true);
		const p = bridge.requestRangeQuery({
			kind: "index",
			mode: "offset",
			sort: { column: "name", direction: "asc" },
			limit: 2,
			offset: 0,
		});
		const requestId = (sent[0] as { requestId: string }).requestId;
		expect((sent[0] as { type: string }).type).toBe("rangeQuery");
		await bridge.handleServerMessage({
			type: "queryRangeChunk",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			requestId,
			rows: [
				item({ id: "1", name: "a", age: 1 }),
				item({ id: "2", name: "b", age: 2 }),
			],
			totalCount: 5,
			lastCursor: "b",
			hasMore: true,
			chunkIndex: 0,
			done: true,
		});
		const result = await p;
		expect(result.rows.length).toBe(2);
		expect(result.totalCount).toBe(5);
	});
});
