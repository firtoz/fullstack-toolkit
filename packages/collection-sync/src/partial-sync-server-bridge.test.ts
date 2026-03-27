import { describe, expect, it } from "bun:test";
import type { SyncMessage } from "@firtoz/db-helpers";
import { PartialSyncServerBridge } from "./partial-sync-server-bridge";

type Item = { id: string; name: string; age: number };

describe("PartialSyncServerBridge", () => {
	it("streams queryRange as chunks and tracks delivered ranges", async () => {
		const sent: unknown[] = [];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 3,
				getSortValue: (row, column) =>
					column === "age" ? row.age : row.name,
				queryRange: async function* () {
					yield [
						{ id: "1", name: "aaaaa", age: 20 },
						{ id: "2", name: "aaaab", age: 21 },
					];
					yield [{ id: "3", name: "aaaac", age: 22 }];
				},
				queryByOffset: async function* () {
					yield [];
				},
			},
			sendToClient: (_clientId, message) => sent.push(message),
			queryChunkSize: 2,
		});

		await bridge.handleClientMessage({
			type: "queryRange",
			clientId: "c1",
			requestId: "r1",
			sort: { column: "name", direction: "asc" },
			limit: 3,
			afterCursor: null,
		});

		expect(sent).toEqual([
			{
				type: "queryRangeChunk",
				requestId: "r1",
				rows: [
					{ id: "1", name: "aaaaa", age: 20 },
					{ id: "2", name: "aaaab", age: 21 },
				],
				totalCount: 3,
				lastCursor: "aaaab",
				hasMore: true,
				chunkIndex: 0,
				done: false,
			},
			{
				type: "queryRangeChunk",
				requestId: "r1",
				rows: [{ id: "3", name: "aaaac", age: 22 }],
				totalCount: 3,
				lastCursor: "aaaac",
				hasMore: false,
				chunkIndex: 1,
				done: true,
			},
		]);

		const state = bridge.getClientState("c1");
		expect(state?.deliveredRanges.length).toBe(2);
	});

	it("queues range patches while streaming and flushes after final chunk", async () => {
		const sent: unknown[] = [];
		let resume!: () => void;
		const resumeGate = new Promise<void>((resolve) => {
			resume = resolve;
		});
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 2,
				getSortValue: (row) => row.name,
				queryRange: async function* () {
					yield [{ id: "1", name: "aaaaa", age: 20 }];
					await resumeGate;
					yield [{ id: "2", name: "aaaab", age: 21 }];
				},
				queryByOffset: async function* () {
					yield [];
				},
			},
			sendToClient: (_clientId, message) => sent.push(message),
			queryChunkSize: 1,
		});

		const inFlight = bridge.handleClientMessage({
			type: "queryRange",
			clientId: "c1",
			requestId: "r1",
			sort: { column: "name", direction: "asc" },
			limit: 2,
			afterCursor: null,
		});

		// Wait for first chunk to be sent before queuing patches.
		for (let i = 0; i < 10 && sent.length === 0; i += 1) {
			await Promise.resolve();
		}
		await bridge.pushServerChanges([
			{ type: "insert", value: { id: "1a", name: "aaaaa", age: 23 } },
		] satisfies SyncMessage<Item>[]);

		// Patch should be queued while stream is active.
		expect(
			sent.some(
				(msg) =>
					typeof msg === "object" &&
					msg !== null &&
					(msg as { type?: string }).type === "rangePatch",
			),
		).toBe(false);

		resume();
		await inFlight;

		const patchMessages = sent.filter(
			(msg) =>
				typeof msg === "object" &&
				msg !== null &&
				(msg as { type?: string }).type === "rangePatch",
		);
		expect(patchMessages.length).toBe(1);
	});

	it("streams queryByOffset as chunks and sets hasMore from offset + delivered", async () => {
		const sent: unknown[] = [];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 100,
				getSortValue: (row, column) =>
					column === "age" ? row.age : row.name,
				queryRange: async function* () {
					yield [];
				},
				queryByOffset: async function* () {
					yield [
						{ id: "1", name: "aaaaa", age: 20 },
						{ id: "2", name: "aaaab", age: 21 },
					];
					yield [{ id: "3", name: "aaaac", age: 22 }];
				},
			},
			sendToClient: (_clientId, message) => sent.push(message),
			queryChunkSize: 2,
		});

		await bridge.handleClientMessage({
			type: "queryByOffset",
			clientId: "c1",
			requestId: "r1",
			sort: { column: "name", direction: "asc" },
			limit: 3,
			offset: 10,
		});

		expect(sent).toEqual([
			{
				type: "queryRangeChunk",
				requestId: "r1",
				rows: [
					{ id: "1", name: "aaaaa", age: 20 },
					{ id: "2", name: "aaaab", age: 21 },
				],
				totalCount: 100,
				lastCursor: "aaaab",
				hasMore: true,
				chunkIndex: 0,
				done: false,
			},
			{
				type: "queryRangeChunk",
				requestId: "r1",
				rows: [{ id: "3", name: "aaaac", age: 22 }],
				totalCount: 100,
				lastCursor: "aaaac",
				hasMore: true,
				chunkIndex: 1,
				done: true,
			},
		]);
	});
});
