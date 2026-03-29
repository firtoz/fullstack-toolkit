import { describe, expect, it } from "bun:test";
import type { SyncMessage } from "@firtoz/db-helpers";
import { PartialSyncServerBridge } from "./partial-sync-server-bridge";
import type { PartialSyncRowShape } from "./partial-sync-row-key";
import { DEFAULT_SYNC_COLLECTION_ID } from "./sync-protocol";

type Item = PartialSyncRowShape & { name: string; age: number };

function item(
	picks: { id: string; name: string; age: number; updatedAt?: number },
): Item {
	return { ...picks, updatedAt: picks.updatedAt ?? 0 };
}

describe("PartialSyncServerBridge", () => {
	it("streams queryRange as chunks and tracks delivered ranges", async () => {
		const sent: unknown[] = [];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 3,
				getSortValue: (row, column) => (column === "age" ? row.age : row.name),
				queryRange: async function* () {
					yield [
						item({ id: "1", name: "aaaaa", age: 20 }),
						item({ id: "2", name: "aaaab", age: 21 }),
					];
					yield [item({ id: "3", name: "aaaac", age: 22 })];
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
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "c1",
			requestId: "r1",
			sort: { column: "name", direction: "asc" },
			limit: 3,
			afterCursor: null,
		});

		expect(sent).toEqual([
			{
				type: "queryRangeChunk",
				collectionId: DEFAULT_SYNC_COLLECTION_ID,
				requestId: "r1",
				rows: [
					item({ id: "1", name: "aaaaa", age: 20 }),
					item({ id: "2", name: "aaaab", age: 21 }),
				],
				totalCount: 3,
				lastCursor: "aaaab",
				hasMore: true,
				chunkIndex: 0,
				done: false,
			},
			{
				type: "queryRangeChunk",
				collectionId: DEFAULT_SYNC_COLLECTION_ID,
				requestId: "r1",
				rows: [item({ id: "3", name: "aaaac", age: 22 })],
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

	it("pushServerChanges with excludeClientId does not emit rangePatch to that client", async () => {
		type Sent = { clientId: string; message: unknown };
		const sent: Sent[] = [];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 2,
				getSortValue: (row, column) => (column === "age" ? row.age : row.name),
				queryRange: async function* () {
					yield [
						item({ id: "1", name: "a", age: 20 }),
						item({ id: "2", name: "b", age: 21 }),
					];
				},
				queryByOffset: async function* () {
					yield [];
				},
			},
			sendToClient: (clientId, message) => sent.push({ clientId, message }),
			queryChunkSize: 2,
		});

		for (const clientId of ["author", "observer"] as const) {
			await bridge.handleClientMessage({
				type: "queryRange",
				collectionId: DEFAULT_SYNC_COLLECTION_ID,
				clientId,
				requestId: `r-${clientId}`,
				sort: { column: "name", direction: "asc" },
				limit: 10,
				afterCursor: null,
			});
		}

		sent.length = 0;

		const upd: SyncMessage<Item> = {
			type: "update",
			value: item({ id: "1", name: "a", age: 99 }),
			previousValue: item({ id: "1", name: "a", age: 20 }),
		};
		await bridge.pushServerChanges([upd], { excludeClientId: "author" });

		const patches = sent.filter(
			(e) =>
				typeof e.message === "object" &&
				e.message !== null &&
				(e.message as { type?: string }).type === "rangePatch",
		);
		expect(patches.map((e) => e.clientId).sort()).toEqual(["observer"]);
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
					yield [item({ id: "1", name: "aaaaa", age: 20 })];
					await resumeGate;
					yield [item({ id: "2", name: "aaaab", age: 21 })];
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
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
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
			{ type: "insert", value: item({ id: "1a", name: "aaaaa", age: 23 }) },
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
				getSortValue: (row, column) => (column === "age" ? row.age : row.name),
				queryRange: async function* () {
					yield [];
				},
				queryByOffset: async function* () {
					yield [
						item({ id: "1", name: "aaaaa", age: 20 }),
						item({ id: "2", name: "aaaab", age: 21 }),
					];
					yield [item({ id: "3", name: "aaaac", age: 22 })];
				},
			},
			sendToClient: (_clientId, message) => sent.push(message),
			queryChunkSize: 2,
		});

		await bridge.handleClientMessage({
			type: "queryByOffset",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "c1",
			requestId: "r1",
			sort: { column: "name", direction: "asc" },
			limit: 3,
			offset: 10,
		});

		expect(sent).toEqual([
			{
				type: "queryRangeChunk",
				collectionId: DEFAULT_SYNC_COLLECTION_ID,
				requestId: "r1",
				rows: [
					item({ id: "1", name: "aaaaa", age: 20 }),
					item({ id: "2", name: "aaaab", age: 21 }),
				],
				totalCount: 100,
				lastCursor: "aaaab",
				hasMore: true,
				chunkIndex: 0,
				done: false,
			},
			{
				type: "queryRangeChunk",
				collectionId: DEFAULT_SYNC_COLLECTION_ID,
				requestId: "r1",
				rows: [item({ id: "3", name: "aaaac", age: 22 })],
				totalCount: 100,
				lastCursor: "aaaac",
				hasMore: true,
				chunkIndex: 1,
				done: true,
			},
		]);
	});

	it("rangeQuery with fingerprint and empty changesSince sends rangeUpToDate", async () => {
		const sent: unknown[] = [];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 10,
				getSortValue: (row, column) => (column === "age" ? row.age : row.name),
				queryRange: async function* () {
					yield [];
				},
				queryByOffset: async function* () {
					yield [];
				},
				changesSince: async () => ({ changes: [], totalCount: 10 }),
			},
			sendToClient: (_clientId, message) => sent.push(message),
			queryChunkSize: 50,
		});

		await bridge.handleClientMessage({
			type: "rangeQuery",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "c1",
			requestId: "r1",
			range: {
				kind: "index",
				mode: "offset",
				sort: { column: "name", direction: "asc" },
				limit: 4,
				offset: 0,
			},
			fingerprint: { version: 100, count: 4 },
		});

		expect(sent).toEqual([
			{
				type: "rangeUpToDate",
				collectionId: DEFAULT_SYNC_COLLECTION_ID,
				requestId: "r1",
				totalCount: 10,
			},
		]);
	});

	it("rangeQuery with fingerprint and small delta sends rangeDelta", async () => {
		const sent: unknown[] = [];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 11,
				getSortValue: (row, column) => (column === "age" ? row.age : row.name),
				queryRange: async function* () {
					yield [];
				},
				queryByOffset: async function* () {
					yield [];
				},
				changesSince: async () => ({
					changes: [
						{
							type: "insert",
							value: item({ id: "x", name: "zzzzz", age: 1 }),
						},
					] satisfies SyncMessage<Item>[],
					totalCount: 11,
				}),
			},
			sendToClient: (_clientId, message) => sent.push(message),
			queryChunkSize: 50,
		});

		await bridge.handleClientMessage({
			type: "rangeQuery",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "c1",
			requestId: "r1",
			range: {
				kind: "index",
				mode: "offset",
				sort: { column: "name", direction: "asc" },
				limit: 10,
				offset: 0,
			},
			fingerprint: { version: 1, count: 10 },
		});

		expect(sent).toEqual([
			{
				type: "rangeDelta",
				collectionId: DEFAULT_SYNC_COLLECTION_ID,
				requestId: "r1",
				totalCount: 11,
				changes: [
					{ type: "insert", value: item({ id: "x", name: "zzzzz", age: 1 }) },
				],
			},
		]);
	});

	it("rangeQuery with fingerprint and oversized delta falls back to full offset fetch", async () => {
		const sent: unknown[] = [];
		const manyChanges = Array.from({ length: 10 }, (_, i) => ({
			type: "insert" as const,
			value: item({ id: `n${i}`, name: `n${i}`, age: i }),
		})) satisfies SyncMessage<Item>[];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 100,
				getSortValue: (row, column) => (column === "age" ? row.age : row.name),
				queryRange: async function* () {
					yield [];
				},
				queryByOffset: async function* () {
					yield [item({ id: "1", name: "a", age: 1 })];
				},
				changesSince: async () => ({
					changes: manyChanges,
					totalCount: 100,
				}),
			},
			sendToClient: (_clientId, message) => sent.push(message),
			queryChunkSize: 50,
		});

		await bridge.handleClientMessage({
			type: "rangeQuery",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "c1",
			requestId: "r1",
			range: {
				kind: "index",
				mode: "offset",
				sort: { column: "name", direction: "asc" },
				limit: 10,
				offset: 0,
			},
			fingerprint: { version: 1, count: 10 },
		});

		expect(
			sent.some((m) => (m as { type?: string }).type === "queryRangeChunk"),
		).toBe(true);
		expect(
			sent.some((m) => (m as { type?: string }).type === "rangeDelta"),
		).toBe(false);
	});

	it("rangeQuery with changesSince null falls back to full fetch", async () => {
		const sent: unknown[] = [];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 3,
				getSortValue: (row, column) => (column === "age" ? row.age : row.name),
				queryRange: async function* () {
					yield [];
				},
				queryByOffset: async function* () {
					yield [item({ id: "1", name: "a", age: 1 })];
				},
				changesSince: async () => null,
			},
			sendToClient: (_clientId, message) => sent.push(message),
			queryChunkSize: 50,
		});

		await bridge.handleClientMessage({
			type: "rangeQuery",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "c1",
			requestId: "r1",
			range: {
				kind: "index",
				mode: "offset",
				sort: { column: "name", direction: "asc" },
				limit: 2,
				offset: 0,
			},
			fingerprint: { version: 1, count: 2 },
		});

		expect(
			sent.some((m) => (m as { type?: string }).type === "queryRangeChunk"),
		).toBe(true);
	});
});
