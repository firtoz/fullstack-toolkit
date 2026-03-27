import { describe, expect, it } from "bun:test";
import { SyncClientBridge } from "./sync-client-bridge";

type Item = { id: string; title: string; updatedAt: number };

describe("SyncClientBridge", () => {
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
			mode: "snapshot",
			serverVersion: 1,
			changes: [
				{ type: "insert", value: { id: "1", title: "only", updatedAt: 1 } },
			],
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
			mode: "delta",
			serverVersion: 2,
			changes: [
				{ type: "insert", value: { id: "2", title: "x", updatedAt: 2 } },
			],
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
			mode: "snapshot",
			serverVersion: 3,
			changes: [],
		});

		expect(received).toEqual([[{ type: "truncate" }]]);
	});
});
