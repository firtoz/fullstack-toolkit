import { describe, expect, it } from "bun:test";
import {
	betweenConditionsForNumericAxes,
	createPartialSyncAdapter,
} from "./partial-sync-adapter";

type Row = { id: string; x: number; y: number; updatedAt: number };

describe("createPartialSyncAdapter", () => {
	it("defaults expandViewport to identity", () => {
		const adapter = createPartialSyncAdapter<
			Row,
			{ lo: number; hi: number },
			"x"
		>({
			toConditions: (v) => [
				{ column: "n", op: "gte", value: v.lo },
				{ column: "n", op: "lte", value: v.hi },
			],
			sort: { column: "x", direction: "asc" },
			getSortValue: (row, col) => (col === "x" ? row.x : row.y),
		});
		const v = { lo: 1, hi: 2 };
		expect(adapter.expandViewport(v, 99)).toBe(v);
		expect(adapter.toConditions(v)).toEqual([
			{ column: "n", op: "gte", value: 1 },
			{ column: "n", op: "lte", value: 2 },
		]);
		expect(
			adapter.getSortValue({ id: "a", x: 3, y: 4, updatedAt: 0 }, "x"),
		).toBe(3);
	});
});

describe("betweenConditionsForNumericAxes", () => {
	it("builds between conditions from accessors", () => {
		type V = { minX: number; maxX: number; minY: number; maxY: number };
		const v: V = { minX: 0, maxX: 10, minY: 2, maxY: 5 };
		expect(
			betweenConditionsForNumericAxes(v, [
				{ column: "x", min: (w) => w.minX, max: (w) => w.maxX },
				{ column: "y", min: (w) => w.minY, max: (w) => w.maxY },
			]),
		).toEqual([
			{ column: "x", op: "between", value: 0, valueTo: 10 },
			{ column: "y", op: "between", value: 2, valueTo: 5 },
		]);
	});
});
