import { describe, expect, it } from "bun:test";
import {
	computeFingerprintForIndexWindow,
	matchesPredicate,
	tryIdsForIndexWindow,
} from "./partial-sync-window-utils";
import type { PeoplePartialSyncCollection, PersonRow } from "./types";

function person(
	id: string,
	overrides: Partial<Pick<PersonRow, "name" | "age" | "updatedAt">> = {},
): PersonRow {
	const updatedAt = overrides.updatedAt ?? new Date(1_700_000_000_000);
	return {
		id,
		name: overrides.name ?? "n",
		age: overrides.age ?? 20,
		createdAt: new Date(1),
		updatedAt,
		deletedAt: null,
	};
}

describe("partial-sync-window-utils", () => {
	it("tryIdsForIndexWindow returns consecutive ids or null", () => {
		const m = new Map<number, PersonRow["id"]>([
			[0, "a"],
			[1, "b"],
		]);
		expect(tryIdsForIndexWindow(m, 0, 2, 10)).toEqual(["a", "b"]);
		expect(tryIdsForIndexWindow(m, 0, 3, 10)).toBe(null);
		expect(tryIdsForIndexWindow(m, 0, 0, 10)).toEqual([]);
	});

	it("computeFingerprintForIndexWindow aggregates max updatedAt and count", () => {
		const byId = new Map<string, PersonRow>([
			["a", person("a", { updatedAt: new Date(100) })],
			["b", person("b", { updatedAt: new Date(250) })],
		]);
		const collection = {
			get: (key: string | number) => byId.get(String(key)),
			subscribeChanges: () => ({ unsubscribe: () => {} }),
			entries: function* () {},
			utils: {},
		} satisfies PeoplePartialSyncCollection;
		const map = new Map<number, PersonRow["id"]>([
			[0, "a"],
			[1, "b"],
		]);
		expect(computeFingerprintForIndexWindow(collection, map, 0, 2)).toEqual({
			version: 250,
			count: 2,
		});
	});

	it("matchesPredicate supports between on age", () => {
		const r = person("x", { age: 15 });
		expect(
			matchesPredicate(r, [
				{ column: "age", op: "between", value: 10, valueTo: 20 },
			]),
		).toBe(true);
		expect(
			matchesPredicate(r, [
				{ column: "age", op: "between", value: 20, valueTo: 30 },
			]),
		).toBe(false);
	});
});
