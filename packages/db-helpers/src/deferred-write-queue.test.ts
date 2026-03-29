import { describe, expect, test } from "bun:test";
import { DeferredWriteQueue } from "./deferred-write-queue";
import type { GenericSyncBackend } from "./generic-sync";

type Row = { id: string; x: number };

function mockBackend(): GenericSyncBackend<Row> & {
	inserts: Row[][];
	updates: Array<{ key: string; changes: Partial<Row>; original: Row }>[];
	batchPuts: Row[][];
	deletes: Array<{ key: string; modified: Row; original: Row }>[];
} {
	const inserts: Row[][] = [];
	const updates: Array<{ key: string; changes: Partial<Row>; original: Row }>[] =
		[];
	const batchPuts: Row[][] = [];
	const deletes: Array<{ key: string; modified: Row; original: Row }>[] = [];
	return {
		inserts,
		updates,
		batchPuts,
		deletes,
		initialLoad: async () => [],
		loadSubset: async () => [],
		handleInsert: async (items) => {
			inserts.push([...items]);
			return items;
		},
		handleUpdate: async (mutations) => {
			updates.push([...mutations]);
			return mutations.map((m) => ({ ...m.original, ...m.changes }) as Row);
		},
		handleBatchPut: async (items) => {
			batchPuts.push([...items]);
		},
		handleDelete: async (mutations) => {
			deletes.push([...mutations]);
		},
	};
}

describe("DeferredWriteQueue", () => {
	test("coalesces multiple updates to same key into one batch put", async () => {
		const backend = mockBackend();
		const q = new DeferredWriteQueue<Row>({
			backend,
			getPersistKey: (r) => r.id,
			flushIntervalMs: 10_000,
		});

		q.enqueueUpdate([
			{
				key: "a",
				changes: { x: 1 },
				original: { id: "a", x: 0 },
			},
			{
				key: "a",
				changes: { x: 2 },
				original: { id: "a", x: 1 },
			},
		]);
		await q.flush();

		expect(backend.inserts.length).toBe(0);
		expect(backend.updates.length).toBe(0);
		expect(backend.batchPuts.length).toBe(1);
		expect(backend.batchPuts[0]).toEqual([{ id: "a", x: 2 }]);
		q.dispose();
	});

	test("delete wins over pending put", async () => {
		const backend = mockBackend();
		const q = new DeferredWriteQueue<Row>({
			backend,
			getPersistKey: (r) => r.id,
			flushIntervalMs: 10_000,
		});

		q.enqueueUpdate([
			{
				key: "a",
				changes: { x: 5 },
				original: { id: "a", x: 0 },
			},
		]);
		q.enqueueDelete([
			{
				key: "a",
				modified: { id: "a", x: 5 },
				original: { id: "a", x: 0 },
			},
		]);
		await q.flush();

		expect(backend.batchPuts.length).toBe(0);
		expect(backend.inserts.length).toBe(0);
		expect(backend.deletes.length).toBe(1);
		q.dispose();
	});

	test("insert then update same key uses insert with final value only", async () => {
		const backend = mockBackend();
		const q = new DeferredWriteQueue<Row>({
			backend,
			getPersistKey: (r) => r.id,
			flushIntervalMs: 10_000,
		});

		q.enqueueInsert([{ id: "a", x: 0 }]);
		q.enqueueUpdate([
			{
				key: "a",
				changes: { x: 9 },
				original: { id: "a", x: 0 },
			},
		]);
		await q.flush();

		expect(backend.batchPuts.length).toBe(0);
		expect(backend.inserts.length).toBe(1);
		expect(backend.inserts[0]).toEqual([{ id: "a", x: 9 }]);
		q.dispose();
	});

	test("falls back to handleUpdate when handleBatchPut missing", async () => {
		const updates: Array<{ key: string; changes: Partial<Row>; original: Row }>[] =
			[];
		const backend: GenericSyncBackend<Row> = {
			initialLoad: async () => [],
			loadSubset: async () => [],
			handleInsert: async (items) => items,
		handleUpdate: async (mutations) => {
			updates.push(mutations);
			return mutations.map((m) => ({ ...m.original, ...m.changes }) as Row);
		},
			handleDelete: async () => {},
		};
		const q = new DeferredWriteQueue<Row>({
			backend,
			getPersistKey: (r) => r.id,
			flushIntervalMs: 10_000,
		});

		q.enqueueUpdate([
			{
				key: "b",
				changes: { x: 3 },
				original: { id: "b", x: 0 },
			},
		]);
		await q.flush();

		expect(updates.length).toBe(1);
		expect(updates[0]?.[0]?.key).toBe("b");
		expect(updates[0]?.[0]?.changes).toEqual({ id: "b", x: 3 });
		q.dispose();
	});
});
