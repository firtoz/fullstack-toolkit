import { describe, expect, it } from "bun:test";
import type { SyncMessage } from "@firtoz/db-helpers";
import {
	classifyPartialSyncRangePatch,
	type DeliveredRange,
} from "./partial-sync-interest";
import { defaultPredicateColumnValue } from "./partial-sync-predicate-match";

type Row = {
	id: string;
	age: number;
	x: number;
	y: number;
	updatedAt: number;
};

const ascAgeRange = (from: number, to: number): DeliveredRange => ({
	sortColumn: "age",
	sortDirection: "asc",
	fromValue: from,
	toValue: to,
});

describe("classifyPartialSyncRangePatch", () => {
	const getSort = (r: Row, c: string) => (c === "age" ? r.age : 0);
	const getCol = defaultPredicateColumnValue<Row>;

	it("update leaving sort range keeps update with exitView", () => {
		const ranges: DeliveredRange[] = [ascAgeRange(50, 60)];
		const change = {
			type: "update" as const,
			value: { id: "a", age: 99, x: 0, y: 0, updatedAt: 0 },
			previousValue: { id: "a", age: 57, x: 0, y: 0, updatedAt: 0 },
		} satisfies SyncMessage<Row>;
		const patch = classifyPartialSyncRangePatch(
			ranges,
			[],
			change,
			getSort,
			getCol,
		);
		expect(patch).toEqual({ change, viewTransition: "exitView" });
	});

	it("update entering sort range keeps update with enterView", () => {
		const ranges: DeliveredRange[] = [ascAgeRange(50, 60)];
		const change = {
			type: "update" as const,
			value: { id: "a", age: 55, x: 0, y: 0, updatedAt: 0 },
			previousValue: { id: "a", age: 15, x: 0, y: 0, updatedAt: 0 },
		} satisfies SyncMessage<Row>;
		const patch = classifyPartialSyncRangePatch(
			ranges,
			[],
			change,
			getSort,
			getCol,
		);
		expect(patch).toEqual({ change, viewTransition: "enterView" });
	});

	it("update staying in range stays update", () => {
		const ranges: DeliveredRange[] = [ascAgeRange(50, 60)];
		const change = {
			type: "update" as const,
			value: { id: "a", age: 58, x: 0, y: 0, updatedAt: 0 },
			previousValue: { id: "a", age: 55, x: 0, y: 0, updatedAt: 0 },
		} satisfies SyncMessage<Row>;
		const patch = classifyPartialSyncRangePatch(
			ranges,
			[],
			change,
			getSort,
			getCol,
		);
		expect(patch).toEqual({ change });
	});

	it("matches predicate-only interest for insert", () => {
		const predicateGroups = [
			[
				{ column: "x", op: "between" as const, value: 0, valueTo: 10 },
				{ column: "y", op: "between" as const, value: 0, valueTo: 10 },
			],
		];
		const change = {
			type: "insert" as const,
			value: { id: "b", age: 1, x: 5, y: 5, updatedAt: 0 },
		} satisfies SyncMessage<Row>;
		const patch = classifyPartialSyncRangePatch(
			[],
			predicateGroups,
			change,
			getSort,
			getCol,
		);
		expect(patch).toEqual({ change });
	});

	it("delete is filtered when deliveredRowIds is set and key was not delivered", () => {
		const patch = classifyPartialSyncRangePatch(
			[],
			[],
			{ type: "delete", key: "a" },
			getSort,
			getCol,
			{ deliveredRowIds: new Set(["b"]) },
		);
		expect(patch).toBeNull();
	});

	it("delete is forwarded when deliveredRowIds contains the key", () => {
		const change = { type: "delete" as const, key: "a" };
		const patch = classifyPartialSyncRangePatch(
			[],
			[],
			change,
			getSort,
			getCol,
			{ deliveredRowIds: new Set(["a"]) },
		);
		expect(patch).toEqual({ change });
	});
});
