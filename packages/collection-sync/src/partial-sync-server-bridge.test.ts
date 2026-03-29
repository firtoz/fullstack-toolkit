import { describe, expect, it } from "bun:test";
import type { SyncMessage } from "@firtoz/db-helpers";
import { PartialSyncServerBridge } from "./partial-sync-server-bridge";
import type { PartialSyncRowShape } from "./partial-sync-row-key";
import {
	DEFAULT_SYNC_COLLECTION_ID,
	type RangeCondition,
} from "./sync-protocol";

type Item = PartialSyncRowShape & {
	name: string;
	age: number;
	x: number;
	y: number;
};

function item(picks: {
	id: string;
	name: string;
	age: number;
	x?: number;
	y?: number;
	updatedAt?: number;
}): Item {
	return {
		...picks,
		x: picks.x ?? 0,
		y: picks.y ?? 0,
		updatedAt: picks.updatedAt ?? 0,
	};
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

	it("predicate rangeQuery rangeDelta drops changes outside predicate (bridge filter)", async () => {
		const sent: unknown[] = [];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 100,
				getSortValue: (row, column) =>
					column === "age" ? row.age : column === "x" ? row.x : row.name,
				queryRange: async function* () {
					yield [];
				},
				queryByOffset: async function* () {
					yield [];
				},
				queryByPredicate: async function* () {
					yield [];
				},
				changesSince: async () => ({
					changes: [
						{
							type: "insert" as const,
							value: item({
								id: "in",
								name: "in",
								age: 1,
								x: 5,
								y: 5,
							}),
						},
						{
							type: "insert" as const,
							value: item({
								id: "out",
								name: "out",
								age: 2,
								x: 500,
								y: 500,
							}),
						},
					] satisfies SyncMessage<Item>[],
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
				kind: "predicate",
				conditions: [
					{ column: "x", op: "between", value: 0, valueTo: 10 },
					{ column: "y", op: "between", value: 0, valueTo: 10 },
				],
				sort: { column: "x", direction: "asc" },
				limit: 50,
			},
			fingerprint: { version: 1, count: 1 },
		});

		const delta = sent.find(
			(m) => (m as { type?: string }).type === "rangeDelta",
		) as { changes: SyncMessage<Item>[] } | undefined;
		expect(delta).toBeDefined();
		expect(delta?.changes).toEqual([
			{
				type: "insert",
				value: item({ id: "in", name: "in", age: 1, x: 5, y: 5 }),
			},
		]);
	});

	it("pushServerChanges notifies only clients whose predicate matches the row", async () => {
		type Sent = { clientId: string; message: unknown };
		const sent: Sent[] = [];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 10,
				getSortValue: (row, column) =>
					column === "x" ? row.x : column === "y" ? row.y : row.name,
				queryRange: async function* () {
					yield [];
				},
				queryByOffset: async function* () {
					yield [];
				},
				queryByPredicate: async function* (opts) {
					const rows: Item[] = [
						item({ id: "a", name: "a", age: 1, x: 5, y: 5 }),
						item({ id: "b", name: "b", age: 1, x: 105, y: 105 }),
					];
					const filtered = rows.filter((r) =>
						opts.conditions.every((c) => {
							if (
								c.op !== "between" ||
								c.valueTo === undefined ||
								typeof c.value !== "number"
							) {
								return false;
							}
							const v = c.column === "x" ? r.x : c.column === "y" ? r.y : 0;
							return v >= c.value && v <= Number(c.valueTo);
						}),
					);
					yield filtered;
				},
				getPredicateCount: async () => 1,
			},
			sendToClient: (clientId, message) => sent.push({ clientId, message }),
			queryChunkSize: 50,
		});

		const leftPred = {
			kind: "predicate" as const,
			conditions: [
				{ column: "x", op: "between" as const, value: 0, valueTo: 50 },
				{ column: "y", op: "between" as const, value: 0, valueTo: 50 },
			],
			sort: { column: "x", direction: "asc" as const },
			limit: 10,
		};
		const rightPred = {
			kind: "predicate" as const,
			conditions: [
				{ column: "x", op: "between" as const, value: 100, valueTo: 150 },
				{ column: "y", op: "between" as const, value: 100, valueTo: 150 },
			],
			sort: { column: "x", direction: "asc" as const },
			limit: 10,
		};

		await bridge.handleClientMessage({
			type: "rangeQuery",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "left",
			requestId: "r-left",
			range: leftPred,
		});
		await bridge.handleClientMessage({
			type: "rangeQuery",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "right",
			requestId: "r-right",
			range: rightPred,
		});

		sent.length = 0;
		await bridge.pushServerChanges([
			{
				type: "update",
				value: item({
					id: "far",
					name: "far",
					age: 9,
					x: 120,
					y: 120,
				}),
				previousValue: item({
					id: "far",
					name: "far",
					age: 8,
					x: 119,
					y: 119,
				}),
			},
		]);

		const patchClients = sent
			.filter(
				(e) =>
					typeof e.message === "object" &&
					e.message !== null &&
					(e.message as { type?: string }).type === "rangePatch",
			)
			.map((e) => e.clientId)
			.sort();
		expect(patchClients).toEqual(["right"]);
	});

	it("second predicate rangeQuery replaces interest so old viewport stops receiving patches", async () => {
		type Sent = { clientId: string; message: unknown };
		const sent: Sent[] = [];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 10,
				getSortValue: (row, column) =>
					column === "x" ? row.x : column === "y" ? row.y : row.name,
				queryRange: async function* () {
					yield [];
				},
				queryByOffset: async function* () {
					yield [];
				},
				queryByPredicate: async function* (opts) {
					const isRight = opts.conditions.some(
						(c) => c.column === "x" && c.op === "between" && c.value === 100,
					);
					if (isRight) {
						yield [item({ id: "r", name: "r", age: 1, x: 105, y: 105 })];
					} else {
						yield [item({ id: "only", name: "o", age: 1, x: 5, y: 5 })];
					}
				},
				getPredicateCount: async () => 1,
			},
			sendToClient: (clientId, message) => sent.push({ clientId, message }),
			queryChunkSize: 50,
		});

		const leftViewport = {
			kind: "predicate" as const,
			conditions: [
				{ column: "x", op: "between" as const, value: 0, valueTo: 10 },
				{ column: "y", op: "between" as const, value: 0, valueTo: 10 },
			],
			sort: { column: "x", direction: "asc" as const },
			limit: 10,
		};
		const rightViewport = {
			kind: "predicate" as const,
			conditions: [
				{ column: "x", op: "between" as const, value: 100, valueTo: 110 },
				{ column: "y", op: "between" as const, value: 100, valueTo: 110 },
			],
			sort: { column: "x", direction: "asc" as const },
			limit: 10,
		};

		await bridge.handleClientMessage({
			type: "rangeQuery",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "c1",
			requestId: "r1",
			range: leftViewport,
		});
		await bridge.handleClientMessage({
			type: "rangeQuery",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "c1",
			requestId: "r2",
			range: rightViewport,
		});

		sent.length = 0;
		await bridge.pushServerChanges([
			{
				type: "update",
				value: item({ id: "only", name: "o", age: 2, x: 5, y: 5 }),
				previousValue: item({ id: "only", name: "o", age: 1, x: 5, y: 5 }),
			},
		]);

		const patches = sent.filter(
			(e) =>
				typeof e.message === "object" &&
				e.message !== null &&
				(e.message as { type?: string }).type === "rangePatch",
		);
		expect(patches.length).toBe(0);
	});

	it("removeClient drops client state", async () => {
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 1,
				getSortValue: (row) => row.name,
				queryRange: async function* () {
					yield [item({ id: "1", name: "a", age: 1 })];
				},
				queryByOffset: async function* () {
					yield [];
				},
			},
			sendToClient: () => {},
			queryChunkSize: 50,
		});
		await bridge.handleClientMessage({
			type: "queryRange",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "gone",
			requestId: "r1",
			sort: { column: "name", direction: "asc" },
			limit: 5,
			afterCursor: null,
		});
		expect(bridge.getClientState("gone")).toBeDefined();
		bridge.removeClient("gone");
		expect(bridge.getClientState("gone")).toBeUndefined();
	});

	it("resolveClientVisibility narrows predicate interest and queries", async () => {
		const sent: unknown[] = [];
		let lastPredicateConditions: RangeCondition[] | undefined;
		const leftPred = {
			kind: "predicate" as const,
			conditions: [
				{ column: "x", op: "between" as const, value: 0, valueTo: 50 },
				{ column: "y", op: "between" as const, value: 0, valueTo: 50 },
			],
			sort: { column: "x", direction: "asc" as const },
			limit: 10,
		};
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 10,
				getSortValue: (row, column) =>
					column === "x" ? row.x : column === "y" ? row.y : row.name,
				queryRange: async function* () {
					yield [];
				},
				queryByOffset: async function* () {
					yield [];
				},
				queryByPredicate: async function* (opts) {
					lastPredicateConditions = opts.conditions;
					yield [item({ id: "in", name: "i", age: 1, x: 5, y: 5 })];
				},
				getPredicateCount: async (conditions) =>
					conditions.some(
						(c) => c.column === "x" && c.value === 0 && c.valueTo === 10,
					)
						? 1
						: 0,
			},
			sendToClient: (_clientId, message) => sent.push(message),
			queryChunkSize: 50,
			resolveClientVisibility: async (_clientId, requested) => {
				const xCond = requested.find((c) => c.column === "x");
				if (xCond?.op !== "between") return requested;
				const xFrom = xCond.value;
				const xTo = xCond.valueTo;
				if (typeof xFrom !== "number" || typeof xTo !== "number") {
					return requested;
				}
				return requested.map((c) =>
					c.column === "x" ? { ...c, value: 0, valueTo: Math.min(10, xTo) } : c,
				);
			},
		});

		await bridge.handleClientMessage({
			type: "rangeQuery",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "c1",
			requestId: "r1",
			range: leftPred,
		});

		const xBetween = lastPredicateConditions?.find((c) => c.column === "x");
		expect(xBetween?.op).toBe("between");
		expect(xBetween).toMatchObject({ value: 0, valueTo: 10 });

		sent.length = 0;
		await bridge.pushServerChanges([
			{
				type: "insert",
				value: item({ id: "outsider", name: "o", age: 1, x: 200, y: 200 }),
			},
		]);
		const patches = sent.filter(
			(m) => (m as { type?: string }).type === "rangePatch",
		);
		expect(patches.length).toBe(0);
	});

	it("setClientVisibility replaces predicate interest for patches", async () => {
		type Sent = { clientId: string; message: unknown };
		const sent: Sent[] = [];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 10,
				getSortValue: (row, column) =>
					column === "x" ? row.x : column === "y" ? row.y : row.name,
				queryRange: async function* () {
					yield [];
				},
				queryByOffset: async function* () {
					yield [];
				},
				queryByPredicate: async function* () {
					yield [];
				},
			},
			sendToClient: (clientId, message) => sent.push({ clientId, message }),
			queryChunkSize: 50,
		});

		bridge.setClientVisibility("c1", [
			{ column: "x", op: "between", value: 0, valueTo: 5 },
			{ column: "y", op: "between", value: 0, valueTo: 5 },
		]);

		sent.length = 0;
		await bridge.pushServerChanges([
			{
				type: "update",
				value: item({ id: "z", name: "z", age: 1, x: 3, y: 3 }),
				previousValue: item({ id: "z", name: "z", age: 1, x: 2, y: 2 }),
			},
		]);
		expect(
			sent.some(
				(e) =>
					(e.message as { type?: string }).type === "rangePatch" &&
					(e.message as { change?: { value?: Item } }).change?.value?.x === 3,
			),
		).toBe(true);

		bridge.setClientVisibility("c1", [
			{ column: "x", op: "between", value: 100, valueTo: 110 },
			{ column: "y", op: "between", value: 100, valueTo: 110 },
		]);
		sent.length = 0;
		await bridge.pushServerChanges([
			{
				type: "update",
				value: item({ id: "z", name: "z", age: 2, x: 4, y: 4 }),
				previousValue: item({ id: "z", name: "z", age: 1, x: 3, y: 3 }),
			},
		]);
		expect(
			sent.some((e) => (e.message as { type?: string }).type === "rangePatch"),
		).toBe(false);
	});

	it("pushServerChanges does not forward delete for undelivered row ids", async () => {
		type Sent = { clientId: string; message: unknown };
		const sent: Sent[] = [];
		const bridge = new PartialSyncServerBridge<Item>({
			store: {
				getTotalCount: async () => 10,
				getSortValue: (row, column) =>
					column === "x" ? row.x : column === "y" ? row.y : row.name,
				queryRange: async function* () {
					yield [];
				},
				queryByOffset: async function* () {
					yield [];
				},
				queryByPredicate: async function* () {
					yield [item({ id: "a", name: "a", age: 1, x: 1, y: 1 })];
				},
				getPredicateCount: async () => 1,
			},
			sendToClient: (clientId, message) => sent.push({ clientId, message }),
			queryChunkSize: 50,
		});

		await bridge.handleClientMessage({
			type: "rangeQuery",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "c1",
			requestId: "r1",
			range: {
				kind: "predicate",
				conditions: [
					{ column: "x", op: "between", value: 0, valueTo: 10 },
					{ column: "y", op: "between", value: 0, valueTo: 10 },
				],
				sort: { column: "x", direction: "asc" },
				limit: 10,
			},
		});

		sent.length = 0;
		await bridge.pushServerChanges([{ type: "delete", key: "other" }]);
		expect(
			sent.some((e) => (e.message as { type?: string }).type === "rangePatch"),
		).toBe(false);

		await bridge.pushServerChanges([{ type: "delete", key: "a" }]);
		expect(
			sent.some(
				(e) =>
					(e.message as { type?: string }).type === "rangePatch" &&
					(e.message as { change?: { type?: string } }).change?.type ===
						"delete",
			),
		).toBe(true);
	});
});
