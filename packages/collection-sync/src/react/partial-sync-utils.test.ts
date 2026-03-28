import { describe, expect, it } from "bun:test";
import {
	assertSyncUtils,
	computeFingerprintForIndexWindow,
	defaultPartialSyncVersionMs,
	getPartialSyncRowByMapId,
	matchesPredicate,
	tryIdsForIndexWindow,
} from "./partial-sync-utils";
import type { PartialSyncCollection, PartialSyncItem } from "./types";

type TestRow = PartialSyncItem & { name: string; age: number };

function person(
	id: string,
	overrides: Partial<Pick<TestRow, "name" | "age" | "updatedAt">> = {},
): TestRow {
	const updatedAt = overrides.updatedAt ?? new Date(1_700_000_000_000);
	return {
		id,
		name: overrides.name ?? "n",
		age: overrides.age ?? 20,
		updatedAt,
	};
}

describe("partial-sync-utils", () => {
	it("assertSyncUtils returns receiveSync and truncate when present", () => {
		const utils = {
			receiveSync: async () => {},
			truncate: async () => {},
			other: 1,
		};
		const u = assertSyncUtils<TestRow>(utils);
		expect(typeof u.receiveSync).toBe("function");
		expect(typeof u.truncate).toBe("function");
	});

	it("assertSyncUtils throws when sync helpers missing", () => {
		expect(() => assertSyncUtils({})).toThrow();
	});

	it("tryIdsForIndexWindow returns consecutive ids or null", () => {
		const m = new Map<number, string>([
			[0, "a"],
			[1, "b"],
		]);
		expect(tryIdsForIndexWindow(m, 0, 2, 10)).toEqual(["a", "b"]);
		expect(tryIdsForIndexWindow(m, 0, 3, 10)).toBe(null);
		expect(tryIdsForIndexWindow(m, 0, 0, 10)).toEqual([]);
	});

	it("getPartialSyncRowByMapId falls back to entries when get misses string/number id", () => {
		const row = person("x");
		const collection = {
			get: (key: string | number) =>
				typeof key === "number" && key === 1 ? row : undefined,
			subscribeChanges: () => ({ unsubscribe: () => {} }),
			entries: function* () {
				yield [1, row] as const;
			},
			utils: { truncate: async () => {}, receiveSync: async () => {} },
		} satisfies PartialSyncCollection<TestRow>;
		expect(getPartialSyncRowByMapId(collection, "1")).toEqual(row);
	});

	it("computeFingerprintForIndexWindow aggregates max version and count", () => {
		const byId = new Map<string, TestRow>([
			["a", person("a", { updatedAt: new Date(100) })],
			["b", person("b", { updatedAt: new Date(250) })],
		]);
		const collection = {
			get: (key: string | number) => byId.get(String(key)),
			subscribeChanges: () => ({ unsubscribe: () => {} }),
			entries: function* () {},
			utils: { truncate: async () => {}, receiveSync: async () => {} },
		} satisfies PartialSyncCollection<TestRow>;
		const map = new Map<number, string>([
			[0, "a"],
			[1, "b"],
		]);
		expect(computeFingerprintForIndexWindow(collection, map, 0, 2)).toEqual({
			version: 250,
			count: 2,
		});
	});

	it("defaultPartialSyncVersionMs reads updatedAt", () => {
		expect(defaultPartialSyncVersionMs(person("x", { updatedAt: 42 }))).toBe(
			42,
		);
	});

	it("matchesPredicate supports between on age", () => {
		const r = person("x", { age: 15 });
		const col = (row: TestRow, c: string) =>
			c === "age" ? row.age : (row as Record<string, unknown>)[c];
		expect(
			matchesPredicate(
				r,
				[{ column: "age", op: "between", value: 10, valueTo: 20 }],
				col,
			),
		).toBe(true);
		expect(
			matchesPredicate(
				r,
				[{ column: "age", op: "between", value: 20, valueTo: 30 }],
				col,
			),
		).toBe(false);
	});
});
