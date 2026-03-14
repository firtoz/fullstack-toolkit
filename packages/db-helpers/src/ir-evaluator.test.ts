import { describe, expect, it } from "bun:test";
import { IR } from "@tanstack/db";
import { evaluateExpression, getExpressionValue } from "./ir-evaluator";

function ref(...path: string[]): IR.PropRef {
	return new IR.PropRef(path);
}

function val(value: unknown): IR.Value {
	return new IR.Value(value);
}

function func(name: string, ...args: IR.BasicExpression[]): IR.Func {
	return new IR.Func(name, args);
}

const item = {
	id: "1",
	title: "Hello World",
	count: 42,
	completed: true,
	tags: ["a", "b"],
	nested: null,
	empty: undefined,
};

describe("getExpressionValue", () => {
	it("resolves ref to item field", () => {
		expect(getExpressionValue(ref("title"), item)).toBe("Hello World");
	});

	it("resolves ref to nested path (uses last segment)", () => {
		expect(getExpressionValue(ref("some", "count"), item)).toBe(42);
	});

	it("returns undefined for missing field", () => {
		expect(getExpressionValue(ref("missing"), item)).toBeUndefined();
	});

	it("resolves val to its literal value", () => {
		expect(getExpressionValue(val(99), item)).toBe(99);
		expect(getExpressionValue(val("text"), item)).toBe("text");
		expect(getExpressionValue(val(null), item)).toBeNull();
	});

	it("throws on func expression", () => {
		expect(() => getExpressionValue(func("eq"), item)).toThrow(
			"Cannot get value from func expression",
		);
	});
});

describe("evaluateExpression", () => {
	describe("ref (truthy check)", () => {
		it("returns true for existing field", () => {
			expect(evaluateExpression(ref("title"), item)).toBe(true);
		});

		it("returns false for undefined field", () => {
			expect(evaluateExpression(ref("empty"), item)).toBe(false);
		});

		it("returns false for missing field", () => {
			expect(evaluateExpression(ref("nonexistent"), item)).toBe(false);
		});
	});

	describe("val (truthy check)", () => {
		it("returns true for truthy value", () => {
			expect(evaluateExpression(val(1), item)).toBe(true);
		});

		it("returns false for falsy value", () => {
			expect(evaluateExpression(val(0), item)).toBe(false);
			expect(evaluateExpression(val(null), item)).toBe(false);
			expect(evaluateExpression(val(""), item)).toBe(false);
		});
	});

	describe("eq", () => {
		it("matches equal values", () => {
			expect(evaluateExpression(func("eq", ref("count"), val(42)), item)).toBe(
				true,
			);
		});

		it("rejects different values", () => {
			expect(evaluateExpression(func("eq", ref("count"), val(99)), item)).toBe(
				false,
			);
		});

		it("matches strings", () => {
			expect(
				evaluateExpression(func("eq", ref("title"), val("Hello World")), item),
			).toBe(true);
		});
	});

	describe("ne", () => {
		it("matches different values", () => {
			expect(evaluateExpression(func("ne", ref("count"), val(99)), item)).toBe(
				true,
			);
		});

		it("rejects equal values", () => {
			expect(evaluateExpression(func("ne", ref("count"), val(42)), item)).toBe(
				false,
			);
		});
	});

	describe("gt / gte / lt / lte", () => {
		it("gt: true when left > right", () => {
			expect(evaluateExpression(func("gt", ref("count"), val(10)), item)).toBe(
				true,
			);
		});

		it("gt: false when equal", () => {
			expect(evaluateExpression(func("gt", ref("count"), val(42)), item)).toBe(
				false,
			);
		});

		it("gte: true when equal", () => {
			expect(evaluateExpression(func("gte", ref("count"), val(42)), item)).toBe(
				true,
			);
		});

		it("lt: true when left < right", () => {
			expect(evaluateExpression(func("lt", ref("count"), val(100)), item)).toBe(
				true,
			);
		});

		it("lt: false when equal", () => {
			expect(evaluateExpression(func("lt", ref("count"), val(42)), item)).toBe(
				false,
			);
		});

		it("lte: true when equal", () => {
			expect(evaluateExpression(func("lte", ref("count"), val(42)), item)).toBe(
				true,
			);
		});
	});

	describe("and / or / not", () => {
		it("and: true when all true", () => {
			const expr = func(
				"and",
				func("eq", ref("count"), val(42)),
				func("eq", ref("completed"), val(true)),
			);
			expect(evaluateExpression(expr, item)).toBe(true);
		});

		it("and: false when one false", () => {
			const expr = func(
				"and",
				func("eq", ref("count"), val(42)),
				func("eq", ref("count"), val(99)),
			);
			expect(evaluateExpression(expr, item)).toBe(false);
		});

		it("or: true when one true", () => {
			const expr = func(
				"or",
				func("eq", ref("count"), val(99)),
				func("eq", ref("count"), val(42)),
			);
			expect(evaluateExpression(expr, item)).toBe(true);
		});

		it("or: false when all false", () => {
			const expr = func(
				"or",
				func("eq", ref("count"), val(99)),
				func("eq", ref("count"), val(100)),
			);
			expect(evaluateExpression(expr, item)).toBe(false);
		});

		it("not: inverts result", () => {
			expect(
				evaluateExpression(
					func("not", func("eq", ref("count"), val(42))),
					item,
				),
			).toBe(false);
			expect(
				evaluateExpression(
					func("not", func("eq", ref("count"), val(99))),
					item,
				),
			).toBe(true);
		});
	});

	describe("isNull / isNotNull / isUndefined", () => {
		it("isNull: true for null", () => {
			expect(evaluateExpression(func("isNull", ref("nested")), item)).toBe(
				true,
			);
		});

		it("isNull: true for undefined", () => {
			expect(evaluateExpression(func("isNull", ref("empty")), item)).toBe(true);
		});

		it("isNull: false for existing", () => {
			expect(evaluateExpression(func("isNull", ref("title")), item)).toBe(
				false,
			);
		});

		it("isNotNull: true for existing", () => {
			expect(evaluateExpression(func("isNotNull", ref("title")), item)).toBe(
				true,
			);
		});

		it("isNotNull: false for null", () => {
			expect(evaluateExpression(func("isNotNull", ref("nested")), item)).toBe(
				false,
			);
		});

		it("isUndefined: true for null/undefined", () => {
			expect(evaluateExpression(func("isUndefined", ref("nested")), item)).toBe(
				true,
			);
			expect(evaluateExpression(func("isUndefined", ref("empty")), item)).toBe(
				true,
			);
		});
	});

	describe("like / ilike", () => {
		it("like: matches exact", () => {
			expect(
				evaluateExpression(
					func("like", ref("title"), val("Hello World")),
					item,
				),
			).toBe(true);
		});

		it("like: matches with % wildcard", () => {
			expect(
				evaluateExpression(func("like", ref("title"), val("Hello%")), item),
			).toBe(true);
			expect(
				evaluateExpression(func("like", ref("title"), val("%World")), item),
			).toBe(true);
			expect(
				evaluateExpression(func("like", ref("title"), val("%lo Wo%")), item),
			).toBe(true);
		});

		it("like: matches with _ wildcard", () => {
			expect(
				evaluateExpression(
					func("like", ref("title"), val("Hello_World")),
					item,
				),
			).toBe(true);
		});

		it("like: is case-sensitive", () => {
			expect(
				evaluateExpression(func("like", ref("title"), val("hello%")), item),
			).toBe(false);
		});

		it("ilike: is case-insensitive", () => {
			expect(
				evaluateExpression(func("ilike", ref("title"), val("hello%")), item),
			).toBe(true);
			expect(
				evaluateExpression(
					func("ilike", ref("title"), val("HELLO WORLD")),
					item,
				),
			).toBe(true);
		});
	});

	describe("in", () => {
		it("matches when value is in array", () => {
			expect(
				evaluateExpression(func("in", ref("id"), val(["1", "2", "3"])), item),
			).toBe(true);
		});

		it("rejects when value is not in array", () => {
			expect(
				evaluateExpression(func("in", ref("id"), val(["4", "5"])), item),
			).toBe(false);
		});
	});

	describe("error cases", () => {
		it("throws on unsupported function name", () => {
			expect(() =>
				evaluateExpression(func("unknown_op", ref("id")), item),
			).toThrow("Unsupported function: unknown_op");
		});
	});
});
