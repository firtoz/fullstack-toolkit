import { describe, expect, it } from "bun:test";
import { SyncServerBridge } from "./sync-server-bridge";

type Item = { id: string; title: string; updatedAt: number };

describe("SyncServerBridge", () => {
	it("converts mutateBatch into ack + syncBatch", async () => {
		const sentToClient: unknown[] = [];
		const broadcasted: unknown[] = [];
		const applied: unknown[] = [];
		const bridge = new SyncServerBridge<Item>({
			store: {
				applySyncMessages: async (messages) => {
					applied.push(messages);
				},
				getSnapshotMessages: async () => [],
				getRow: () => undefined,
			},
			sendToClient: (_clientId, message) => {
				sentToClient.push(message);
			},
			broadcastExcept: (_excludeClientId, message) => {
				broadcasted.push(message);
			},
		});

		await bridge.handleClientMessage({
			type: "mutateBatch",
			clientId: "c1",
			mutations: [
				{
					clientMutationId: "m1",
					type: "insert",
					value: { id: "1", title: "hello", updatedAt: 1 },
				},
			],
		});

		expect(applied.length).toBe(1);
		expect(sentToClient.length).toBe(1);
		expect(broadcasted.length).toBe(1);
	});

	it("falls back to snapshot when client version is ahead", async () => {
		const sentToClient: unknown[] = [];
		const snapshotChanges = [
			{
				type: "insert" as const,
				value: { id: "1", title: "snap", updatedAt: 1 },
			},
		];
		const bridge = new SyncServerBridge<Item>({
			store: {
				applySyncMessages: async () => {},
				getSnapshotMessages: async () => snapshotChanges,
				getRow: () => undefined,
			},
			sendToClient: (_clientId, message) => {
				sentToClient.push(message);
			},
			broadcastExcept: () => {},
		});

		await bridge.handleClientMessage({
			type: "syncHello",
			clientId: "c1",
			lastAckedServerVersion: 7,
		});

		expect(sentToClient).toEqual([
			{
				type: "syncBackfill",
				mode: "snapshot",
				serverVersion: 0,
				changes: snapshotChanges,
			},
		]);
	});

	it("emits snapshot mode for baseline hello", async () => {
		const sentToClient: unknown[] = [];
		const snapshotChanges = [
			{ type: "insert" as const, value: { id: "1", title: "a", updatedAt: 1 } },
		];
		const bridge = new SyncServerBridge<Item>({
			store: {
				applySyncMessages: async () => {},
				getSnapshotMessages: async () => snapshotChanges,
				getRow: () => undefined,
			},
			sendToClient: (_clientId, message) => {
				sentToClient.push(message);
			},
			broadcastExcept: () => {},
		});

		await bridge.handleClientMessage({
			type: "syncHello",
			clientId: "c1",
			lastAckedServerVersion: 0,
		});

		expect(sentToClient).toEqual([
			{
				type: "syncBackfill",
				mode: "snapshot",
				serverVersion: 0,
				changes: snapshotChanges,
			},
		]);
	});

	it("emits delta mode when replaying changelog", async () => {
		const sentToClient: unknown[] = [];
		const bridge = new SyncServerBridge<Item>({
			store: {
				applySyncMessages: async () => {},
				getSnapshotMessages: async () => [],
				getRow: () => undefined,
			},
			sendToClient: (_clientId, message) => {
				sentToClient.push(message);
			},
			broadcastExcept: () => {},
		});

		await bridge.handleClientMessage({
			type: "mutateBatch",
			clientId: "c1",
			mutations: [
				{
					clientMutationId: "m1",
					type: "insert",
					value: { id: "1", title: "first", updatedAt: 1 },
				},
			],
		});
		await bridge.handleClientMessage({
			type: "mutateBatch",
			clientId: "c2",
			mutations: [
				{
					clientMutationId: "m2",
					type: "insert",
					value: { id: "2", title: "second", updatedAt: 2 },
				},
			],
		});

		sentToClient.length = 0;
		await bridge.handleClientMessage({
			type: "syncHello",
			clientId: "c3",
			lastAckedServerVersion: 1,
		});

		expect(sentToClient).toEqual([
			{
				type: "syncBackfill",
				mode: "delta",
				serverVersion: 2,
				changes: [
					{
						type: "insert",
						value: { id: "2", title: "second", updatedAt: 2 },
					},
				],
			},
		]);
	});

	it("pushServerChanges broadcasts to all clients", async () => {
		const broadcastAll: unknown[] = [];
		const bridge = new SyncServerBridge<Item>({
			store: {
				applySyncMessages: async () => {},
				getSnapshotMessages: async () => [],
				getRow: () => undefined,
			},
			sendToClient: () => {},
			broadcastExcept: () => {},
			broadcastAll: (message) => {
				broadcastAll.push(message);
			},
		});

		await bridge.pushServerChanges([
			{ type: "insert", value: { id: "x", title: "srv", updatedAt: 1 } },
		]);

		expect(broadcastAll).toEqual([
			{
				type: "syncBatch",
				serverVersion: 1,
				changes: [
					{ type: "insert", value: { id: "x", title: "srv", updatedAt: 1 } },
				],
			},
		]);
	});
});
