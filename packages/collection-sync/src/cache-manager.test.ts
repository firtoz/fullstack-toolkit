import { describe, expect, it } from "bun:test";
import { CacheManager } from "./cache-manager";

type Row = { id: string; name: string; age: number };

describe("CacheManager", () => {
	it("does not evict when below threshold", async () => {
		const deleted: Array<string | number> = [];
		const cache = new CacheManager<Row>({
			getStorageEstimate: async () => ({
				usageBytes: 100,
				quotaBytes: 1000,
				utilizationRatio: 0.1,
			}),
			deleteRows: async (keys) => {
				deleted.push(...keys);
			},
		});

		cache.recordFetchedRows([{ id: "1", name: "aaaaa", age: 20 }], (row) => ({
			name: row.name,
			age: row.age,
		}));
		const result = await cache.evictIfNeeded({
			sortColumn: "name",
			sortDirection: "asc",
			fromValue: "aaaaa",
			toValue: "aaaaz",
		});

		expect(result.evictedKeys).toEqual([]);
		expect(deleted).toEqual([]);
		expect(cache.entryCount).toBe(1);
	});

	it("evicts distant rows first when over threshold", async () => {
		const deleted: Array<string | number> = [];
		const cache = new CacheManager<Row>({
			getStorageEstimate: async () => ({
				usageBytes: 900,
				quotaBytes: 1000,
				utilizationRatio: 0.9,
			}),
			deleteRows: async (keys) => {
				deleted.push(...keys);
			},
			estimateRowSize: () => 200,
		});

		cache.recordFetchedRows(
			[
				{ id: "near", name: "mmmmm", age: 20 },
				{ id: "farA", name: "aaaaa", age: 21 },
				{ id: "farZ", name: "zzzzz", age: 22 },
			],
			(row) => ({ name: row.name, age: row.age }),
		);
		cache.markAccessed(["near"]);

		const result = await cache.evictIfNeeded({
			sortColumn: "name",
			sortDirection: "asc",
			fromValue: "mmmmm",
			toValue: "mmmmm",
		});

		expect(result.evictedKeys.length).toBeGreaterThan(0);
		expect(result.evictedKeys.includes("near")).toBe(false);
		expect(deleted.length).toBe(result.evictedKeys.length);
	});

	it("inverted viewport fromValue/toValue still protects rows between first and last sort keys", async () => {
		const deleted: Array<string | number> = [];
		const cache = new CacheManager<Row>({
			getStorageEstimate: async () => ({
				usageBytes: 900,
				quotaBytes: 1000,
				utilizationRatio: 0.9,
			}),
			deleteRows: async (keys) => {
				deleted.push(...keys);
			},
			estimateRowSize: () => 200,
		});

		cache.recordFetchedRows(
			[
				{ id: "low", name: "aaaaa", age: 1 },
				{ id: "mid", name: "mmmmm", age: 1 },
				{ id: "high", name: "zzzzz", age: 1 },
				{ id: "far", name: "00000", age: 1 },
			],
			(row) => ({ name: row.name }),
		);
		cache.markAccessed(["mid"]);

		const result = await cache.evictIfNeeded({
			sortColumn: "name",
			sortDirection: "asc",
			fromValue: "zzzzz",
			toValue: "aaaaa",
		});

		expect(result.evictedKeys.includes("mid")).toBe(false);
		expect(deleted.includes("mid")).toBe(false);
		expect(result.evictedKeys.includes("far")).toBe(true);
	});

	it("resyncSortPositionsForTrackedRows keeps row protected when sort key changes in the live row", async () => {
		const deleted: Array<string | number> = [];
		const cache = new CacheManager<Row>({
			getStorageEstimate: async () => ({
				usageBytes: 900,
				quotaBytes: 1000,
				utilizationRatio: 0.9,
			}),
			deleteRows: async (keys) => {
				deleted.push(...keys);
			},
			estimateRowSize: () => 200,
		});

		cache.recordFetchedRows([{ id: "a", name: "aaaaa", age: 1 }], (row) => ({
			name: row.name,
		}));

		const liveRows = new Map<string | number, Row>([
			["a", { id: "a", name: "test", age: 1 }],
		]);
		cache.resyncSortPositionsForTrackedRows(
			(key) => liveRows.get(key),
			(row) => ({ name: row.name }),
		);

		const result = await cache.evictIfNeeded({
			sortColumn: "name",
			sortDirection: "asc",
			fromValue: "test",
			toValue: "test",
		});

		expect(result.evictedKeys.includes("a")).toBe(false);
		expect(deleted.includes("a")).toBe(false);
	});
});
