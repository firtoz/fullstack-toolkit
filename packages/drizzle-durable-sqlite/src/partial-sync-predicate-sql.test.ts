import { describe, expect, it } from "bun:test";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
	coercePredicateScalar,
	predicateWhereFromConditions,
	rangeConditionToSQL,
	sortColumnFromConfig,
	type PartialSyncTableConfig,
} from "./partial-sync-predicate-sql";

const testTable = sqliteTable("predicate_test", {
	name: text("name").notNull(),
	age: integer("age").notNull(),
});

const config = {
	columns: {
		name: { kind: "text" as const },
		age: { kind: "integer" as const },
	},
	sortableColumns: ["name", "age"] as const,
} satisfies PartialSyncTableConfig<"name" | "age">;

describe("coercePredicateScalar", () => {
	it("coerces integer columns", () => {
		expect(coercePredicateScalar("age", 42, config)).toBe(42);
		expect(() => coercePredicateScalar("age", "x", config)).toThrow();
	});

	it("coerces text columns", () => {
		expect(coercePredicateScalar("name", 1, config)).toBe("1");
	});
});

describe("rangeConditionToSQL", () => {
	it("supports eq / neq / comparisons", () => {
		expect(
			rangeConditionToSQL(
				testTable,
				{ column: "age", op: "eq", value: 3 },
				config,
			),
		).toBeDefined();
		expect(
			rangeConditionToSQL(
				testTable,
				{ column: "name", op: "neq", value: "a" },
				config,
			),
		).toBeDefined();
		expect(
			rangeConditionToSQL(
				testTable,
				{ column: "age", op: "gt", value: 1 },
				config,
			),
		).toBeDefined();
		expect(
			rangeConditionToSQL(
				testTable,
				{ column: "age", op: "gte", value: 1 },
				config,
			),
		).toBeDefined();
		expect(
			rangeConditionToSQL(
				testTable,
				{ column: "age", op: "lt", value: 9 },
				config,
			),
		).toBeDefined();
		expect(
			rangeConditionToSQL(
				testTable,
				{ column: "age", op: "lte", value: 9 },
				config,
			),
		).toBeDefined();
	});

	it("supports between", () => {
		expect(
			rangeConditionToSQL(
				testTable,
				{ column: "age", op: "between", value: 1, valueTo: 10 },
				config,
			),
		).toBeDefined();
	});
});

describe("predicateWhereFromConditions", () => {
	it("returns undefined for empty conditions", () => {
		expect(predicateWhereFromConditions(testTable, [], config)).toBeUndefined();
	});

	it("AND-combines multiple conditions", () => {
		const w = predicateWhereFromConditions(
			testTable,
			[
				{ column: "age", op: "gte", value: 5 },
				{ column: "age", op: "lte", value: 10 },
			],
			config,
		);
		expect(w).toBeDefined();
	});
});

describe("sortColumnFromConfig", () => {
	it("resolves sortable columns", () => {
		expect(sortColumnFromConfig(testTable, "name", config)).toBeDefined();
		expect(sortColumnFromConfig(testTable, "age", config)).toBeDefined();
	});

	it("rejects unknown sort columns", () => {
		expect(() =>
			sortColumnFromConfig(testTable, "nope", config as PartialSyncTableConfig),
		).toThrow();
	});
});
