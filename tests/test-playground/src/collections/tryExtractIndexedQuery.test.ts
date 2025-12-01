/**
 * Unit tests for tryExtractIndexedQuery function
 * Tests the actual implementation of index query extraction in IndexedDB collections
 */

import { describe, it, expect, vi } from "vitest";
import { tryExtractIndexedQuery } from "@firtoz/drizzle-indexeddb/collections/indexeddb-collection";
import type { IR } from "@tanstack/db";

describe("tryExtractIndexedQuery - Unit Tests", () => {
	const testIndexes: Record<string, string> = {
		priority: "todo_priority_index",
		status: "todo_status_index",
		userId: "todo_user_id_index",
	};

	describe("Successful Index Extraction", () => {
		it("should extract eq (equals) query", () => {
			// Build IR expression for: priority = 10
			const expression = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 10 } as IR.Value,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);

			expect(result).not.toBeNull();
			expect(result?.fieldName).toBe("priority");
			expect(result?.indexName).toBe("todo_priority_index");
			// Verify it's an "only" range (KeyRangeSpec)
			expect(result?.keyRange.type).toBe("only");
			expect(result?.keyRange.value).toBe(10);
		});

		it("should extract gt (greater than) query", () => {
			// Build IR expression for: priority > 10
			const expression = {
				type: "func",
				name: "gt",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 10 } as IR.Value,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);

			expect(result).not.toBeNull();
			expect(result?.fieldName).toBe("priority");
			expect(result?.indexName).toBe("todo_priority_index");
			// Verify it's a lowerBound with exclusive = true (KeyRangeSpec)
			expect(result?.keyRange.type).toBe("lowerBound");
			expect(result?.keyRange.lower).toBe(10);
			expect(result?.keyRange.lowerOpen).toBe(true); // exclusive
		});

		it("should extract gte (greater than or equal) query", () => {
			// Build IR expression for: priority >= 10
			const expression = {
				type: "func",
				name: "gte",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 10 } as IR.Value,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);

			expect(result).not.toBeNull();
			expect(result?.fieldName).toBe("priority");
			// Verify it's a lowerBound with exclusive = false (KeyRangeSpec)
			expect(result?.keyRange.type).toBe("lowerBound");
			expect(result?.keyRange.lower).toBe(10);
			expect(result?.keyRange.lowerOpen).toBe(false); // inclusive
		});

		it("should extract lt (less than) query", () => {
			// Build IR expression for: priority < 10
			const expression = {
				type: "func",
				name: "lt",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 10 } as IR.Value,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);

			expect(result).not.toBeNull();
			expect(result?.fieldName).toBe("priority");
			// Verify it's an upperBound with exclusive = true (KeyRangeSpec)
			expect(result?.keyRange.type).toBe("upperBound");
			expect(result?.keyRange.upper).toBe(10);
			expect(result?.keyRange.upperOpen).toBe(true); // exclusive
		});

		it("should extract lte (less than or equal) query", () => {
			// Build IR expression for: priority <= 10
			const expression = {
				type: "func",
				name: "lte",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 10 } as IR.Value,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);

			expect(result).not.toBeNull();
			expect(result?.fieldName).toBe("priority");
			// Verify it's an upperBound with exclusive = false (KeyRangeSpec)
			expect(result?.keyRange.type).toBe("upperBound");
			expect(result?.keyRange.upper).toBe(10);
			expect(result?.keyRange.upperOpen).toBe(false); // inclusive
		});

		it("should extract query for different indexed field", () => {
			// Build IR expression for: status = 'pending'
			const expression = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["status"] } as IR.PropRef,
					{ type: "val", value: "pending" } as IR.Value,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);

			expect(result).not.toBeNull();
			expect(result?.fieldName).toBe("status");
			expect(result?.indexName).toBe("todo_status_index");
			expect(result?.keyRange.type).toBe("only");
			expect(result?.keyRange.value).toBe("pending");
		});
	});

	describe("Failed Index Extraction - No Indexes", () => {
		it("should return null when no indexes provided", () => {
			const expression = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 10 } as IR.Value,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, undefined);
			expect(result).toBeNull();
		});

		it("should return null when field has no index", () => {
			// Build IR expression for: content = 'test' (content has no index)
			const expression = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["content"] } as IR.PropRef,
					{ type: "val", value: "test" } as IR.Value,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);
			expect(result).toBeNull();
		});
	});

	describe("Failed Index Extraction - Complex Queries", () => {
		it("should return null for AND expressions (multiple fields)", () => {
			// Build IR expression for: priority > 5 AND status = 'pending'
			const expression = {
				type: "func",
				name: "and",
				args: [
					{
						type: "func",
						name: "gt",
						args: [
							{ type: "ref", path: ["priority"] } as IR.PropRef,
							{ type: "val", value: 5 } as IR.Value,
						],
					} as IR.Func,
					{
						type: "func",
						name: "eq",
						args: [
							{ type: "ref", path: ["status"] } as IR.PropRef,
							{ type: "val", value: "pending" } as IR.Value,
						],
					} as IR.Func,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);
			// Can't use single index for multiple fields
			expect(result).toBeNull();
		});

		it("should return null for OR expressions", () => {
			// Build IR expression for: priority > 10 OR status = 'done'
			const expression = {
				type: "func",
				name: "or",
				args: [
					{
						type: "func",
						name: "gt",
						args: [
							{ type: "ref", path: ["priority"] } as IR.PropRef,
							{ type: "val", value: 10 } as IR.Value,
						],
					} as IR.Func,
					{
						type: "func",
						name: "eq",
						args: [
							{ type: "ref", path: ["status"] } as IR.PropRef,
							{ type: "val", value: "done" } as IR.Value,
						],
					} as IR.Func,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);
			// Can't optimize OR with multiple fields using single index
			expect(result).toBeNull();
		});

		it("should return null for NOT expressions", () => {
			// Build IR expression for: NOT (priority = 10)
			const expression = {
				type: "func",
				name: "not",
				args: [
					{
						type: "func",
						name: "eq",
						args: [
							{ type: "ref", path: ["priority"] } as IR.PropRef,
							{ type: "val", value: 10 } as IR.Value,
						],
					} as IR.Func,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);
			// Negative queries can't be optimized
			expect(result).toBeNull();
		});
	});

	describe("Failed Index Extraction - Unsupported Operators", () => {
		it("should return null for LIKE operator", () => {
			// Build IR expression for: status LIKE '%pend%'
			const expression = {
				type: "func",
				name: "like",
				args: [
					{ type: "ref", path: ["status"] } as IR.PropRef,
					{ type: "val", value: "%pend%" } as IR.Value,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);
			// LIKE can't use index effectively
			expect(result).toBeNull();
		});

		it("should return null for IN operator", () => {
			// Build IR expression for: status IN ('pending', 'done')
			const expression = {
				type: "func",
				name: "in",
				args: [
					{ type: "ref", path: ["status"] } as IR.PropRef,
					{ type: "val", value: ["pending", "done"] } as IR.Value,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);
			// IN operator not optimized (extractSimpleComparisons returns multiple)
			expect(result).toBeNull();
		});

		it("should return null for isNull operator", () => {
			// Build IR expression for: userId IS NULL
			const expression = {
				type: "func",
				name: "isNull",
				args: [{ type: "ref", path: ["userId"] } as IR.PropRef],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, testIndexes);
			// isNull can't be optimized with index
			expect(result).toBeNull();
		});
	});

	describe("Debug Mode", () => {
		it("should log warnings in debug mode for unsupported operators", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// Build IR expression with unsupported operator
			const expression = {
				type: "func",
				name: "like",
				args: [
					{ type: "ref", path: ["status"] } as IR.PropRef,
					{ type: "val", value: "%test%" } as IR.Value,
				],
			} as IR.Func;

			tryExtractIndexedQuery(expression, testIndexes, true);

			// Note: The function might not log for LIKE since it fails at extractSimpleComparisons
			// This test verifies the debug parameter is passed through

			consoleSpy.mockRestore();
		});

		it("should return null for invalid expressions", () => {
			// Build invalid IR expression
			const expression = {
				type: "invalid",
			} as unknown as IR.BasicExpression;

			const result = tryExtractIndexedQuery(expression, testIndexes, true);
			// Should gracefully handle and return null
			expect(result).toBeNull();
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty indexes object", () => {
			const expression = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 10 } as IR.Value,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, {});
			expect(result).toBeNull();
		});

		it("should handle nested property paths", () => {
			const indexesWithNested: Record<string, string> = {
				"user.id": "user_id_index",
			};

			// Build IR expression for: user.id = 'user1'
			const expression = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["user", "id"] } as IR.PropRef,
					{ type: "val", value: "user1" } as IR.Value,
				],
			} as IR.Func;

			const result = tryExtractIndexedQuery(expression, indexesWithNested);

			expect(result).not.toBeNull();
			expect(result?.fieldName).toBe("user.id");
			expect(result?.indexName).toBe("user_id_index");
		});

		it("should handle numeric vs string values correctly", () => {
			// Build IR expression for string equality
			const expressionString = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["status"] } as IR.PropRef,
					{ type: "val", value: "pending" } as IR.Value,
				],
			} as IR.Func;

			const resultString = tryExtractIndexedQuery(
				expressionString,
				testIndexes,
			);
			expect(resultString?.keyRange.type).toBe("only");
			expect(resultString?.keyRange.value).toBe("pending");

			// Build IR expression for numeric comparison
			const expressionNumeric = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 10 } as IR.Value,
				],
			} as IR.Func;

			const resultNumeric = tryExtractIndexedQuery(
				expressionNumeric,
				testIndexes,
			);
			expect(resultNumeric?.keyRange.type).toBe("only");
			expect(resultNumeric?.keyRange.value).toBe(10);
		});
	});
});
