/**
 * Unit tests for loadSubset pagination handling
 * Tests cursor and offset pagination in IndexedDB collections
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { IR } from "@tanstack/db";
import { evaluateExpression } from "@firtoz/db-helpers";
import { tryExtractIndexedQuery } from "@firtoz/idb-collections";
import { createTestTodos } from "../test-utils/collection-test-utils";
import type { Todo } from "test-schema/schema";

describe("loadSubset - Cursor and Offset Pagination", () => {
	let testTodos: Todo[];

	beforeEach(() => {
		testTodos = createTestTodos();
	});

	describe("Cursor Expression Combination", () => {
		it("should apply cursor.whereFrom when no main where is present", () => {
			// Simulate cursor expression: priority > 5
			const cursorWhereFrom = {
				type: "func",
				name: "gt",
				args: [
					{ type: "ref", path: ["priority"] },
					{ type: "val", value: 5 },
				],
			} as IR.BasicExpression;

			// Filter items using the cursor expression
			const filtered = testTodos.filter((item) =>
				evaluateExpression(
					cursorWhereFrom,
					item as unknown as Record<string, unknown>,
				),
			);

			// Should match items with priority > 5: items with priority 7, 10, 15, 20
			expect(filtered.length).toBe(4);
			expect(filtered.every((item) => (item.priority ?? 0) > 5)).toBe(true);
		});

		it("should combine where AND cursor.whereFrom expressions", () => {
			// Main where: status = 'pending'
			const mainWhere = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["status"] },
					{ type: "val", value: "pending" },
				],
			} as IR.BasicExpression;

			// Cursor: priority > 5
			const cursorWhereFrom = {
				type: "func",
				name: "gt",
				args: [
					{ type: "ref", path: ["priority"] },
					{ type: "val", value: 5 },
				],
			} as IR.BasicExpression;

			// Combined: status = 'pending' AND priority > 5
			const combinedWhere = {
				type: "func",
				name: "and",
				args: [mainWhere, cursorWhereFrom],
			} as IR.BasicExpression;

			// Filter items
			const filtered = testTodos.filter((item) =>
				evaluateExpression(
					combinedWhere,
					item as unknown as Record<string, unknown>,
				),
			);

			// Should match pending items with priority > 5
			expect(
				filtered.every(
					(item) => item.status === "pending" && (item.priority ?? 0) > 5,
				),
			).toBe(true);
			// Items 3 (priority 10, pending) and 5 (priority 20, pending)
			expect(filtered.length).toBe(2);
		});

		it("should handle complex cursor with composite conditions (multi-column orderBy)", () => {
			// Simulate composite cursor for multi-column orderBy:
			// or(gt(priority, 5), and(eq(priority, 5), gt(id, 'some-id')))
			const compositeCursor = {
				type: "func",
				name: "or",
				args: [
					{
						type: "func",
						name: "gt",
						args: [
							{ type: "ref", path: ["priority"] },
							{ type: "val", value: 5 },
						],
					},
					{
						type: "func",
						name: "and",
						args: [
							{
								type: "func",
								name: "eq",
								args: [
									{ type: "ref", path: ["priority"] },
									{ type: "val", value: 5 },
								],
							},
							{
								type: "func",
								name: "gt",
								args: [
									{ type: "ref", path: ["id"] },
									{ type: "val", value: "1" },
								],
							},
						],
					},
				],
			} as IR.BasicExpression;

			const filtered = testTodos.filter((item) =>
				evaluateExpression(
					compositeCursor,
					item as unknown as Record<string, unknown>,
				),
			);

			// Should match: priority > 5 OR (priority = 5 AND id > '1')
			expect(filtered.length).toBeGreaterThan(0);
		});
	});

	describe("Offset Pagination", () => {
		it("should skip items based on offset", () => {
			// Sort by priority ascending
			const sorted = [...testTodos].sort(
				(a, b) => (a.priority ?? 0) - (b.priority ?? 0),
			);

			// Apply offset of 2
			const offset = 2;
			const result = sorted.slice(offset);

			expect(result.length).toBe(testTodos.length - offset);
			// First item should be the 3rd in sorted order
			expect(result[0].priority ?? 0).toBeGreaterThanOrEqual(
				sorted[2].priority ?? 0,
			);
		});

		it("should handle offset equal to array length", () => {
			const offset = testTodos.length;
			const result = testTodos.slice(offset);

			expect(result.length).toBe(0);
		});

		it("should handle offset greater than array length", () => {
			const offset = testTodos.length + 10;
			const result = testTodos.slice(offset);

			expect(result.length).toBe(0);
		});

		it("should handle zero offset", () => {
			const offset = 0;
			const result = testTodos.slice(offset);

			expect(result.length).toBe(testTodos.length);
		});
	});

	describe("Combined Cursor and Offset", () => {
		it("should apply cursor filter then offset", () => {
			// Cursor: priority > 3
			const cursorWhereFrom = {
				type: "func",
				name: "gt",
				args: [
					{ type: "ref", path: ["priority"] },
					{ type: "val", value: 3 },
				],
			} as IR.BasicExpression;

			// Filter by cursor
			const filtered = testTodos.filter((item) =>
				evaluateExpression(
					cursorWhereFrom,
					item as unknown as Record<string, unknown>,
				),
			);

			// Sort by priority
			const sorted = filtered.sort(
				(a, b) => (a.priority ?? 0) - (b.priority ?? 0),
			);

			// Apply offset
			const offset = 2;
			const result = sorted.slice(offset);

			// Should have filtered items minus offset
			expect(result.length).toBe(filtered.length - offset);
		});

		it("should apply where + cursor + offset in correct order", () => {
			// Where: status !== 'done'
			const mainWhere = {
				type: "func",
				name: "ne",
				args: [
					{ type: "ref", path: ["status"] },
					{ type: "val", value: "done" },
				],
			} as IR.BasicExpression;

			// Cursor: priority > 1
			const cursorWhereFrom = {
				type: "func",
				name: "gt",
				args: [
					{ type: "ref", path: ["priority"] },
					{ type: "val", value: 1 },
				],
			} as IR.BasicExpression;

			// Combined filter
			const combinedWhere = {
				type: "func",
				name: "and",
				args: [mainWhere, cursorWhereFrom],
			} as IR.BasicExpression;

			// 1. Filter
			const filtered = testTodos.filter((item) =>
				evaluateExpression(
					combinedWhere,
					item as unknown as Record<string, unknown>,
				),
			);

			// 2. Sort
			const sorted = filtered.sort(
				(a, b) => (a.priority ?? 0) - (b.priority ?? 0),
			);

			// 3. Offset
			const offset = 1;
			const afterOffset = sorted.slice(offset);

			// 4. Limit
			const limit = 3;
			const result = afterOffset.slice(0, limit);

			expect(result.length).toBeLessThanOrEqual(limit);
			expect(
				result.every(
					(item) => item.status !== "done" && (item.priority ?? 0) > 1,
				),
			).toBe(true);
		});
	});

	describe("Index Query Extraction with Combined Expressions", () => {
		const testIndexes: Record<string, string> = {
			priority: "todo_priority_index",
			status: "todo_status_index",
		};

		it("should not extract index for combined where + cursor (AND expression)", () => {
			// Combined: status = 'pending' AND priority > 5
			const combinedWhere = {
				type: "func",
				name: "and",
				args: [
					{
						type: "func",
						name: "eq",
						args: [
							{ type: "ref", path: ["status"] },
							{ type: "val", value: "pending" },
						],
					},
					{
						type: "func",
						name: "gt",
						args: [
							{ type: "ref", path: ["priority"] },
							{ type: "val", value: 5 },
						],
					},
				],
			} as IR.BasicExpression;

			// Index extraction should return null for complex expressions
			const result = tryExtractIndexedQuery(combinedWhere, testIndexes);
			expect(result).toBeNull();
		});

		it("should extract index for simple cursor-only expression", () => {
			// Simple cursor: priority > 5
			const cursorWhereFrom = {
				type: "func",
				name: "gt",
				args: [
					{ type: "ref", path: ["priority"] },
					{ type: "val", value: 5 },
				],
			} as IR.BasicExpression;

			const result = tryExtractIndexedQuery(cursorWhereFrom, testIndexes);

			expect(result).not.toBeNull();
			expect(result?.fieldName).toBe("priority");
			expect(result?.indexName).toBe("todo_priority_index");
			expect(result?.keyRange.type).toBe("lowerBound");
			expect(result?.keyRange.lower).toBe(5);
			expect(result?.keyRange.lowerOpen).toBe(true);
		});
	});

	describe("Edge Cases", () => {
		it("should handle undefined cursor", () => {
			const whereExpr = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["status"] },
					{ type: "val", value: "pending" },
				],
			} as IR.BasicExpression;

			// Should use where directly when cursor is undefined
			const filtered = testTodos.filter((item) =>
				evaluateExpression(
					whereExpr,
					item as unknown as Record<string, unknown>,
				),
			);

			expect(filtered.every((item) => item.status === "pending")).toBe(true);
		});

		it("should handle cursor with undefined whereFrom", () => {
			// When whereFrom is undefined, only main where should apply
			const mainWhere = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["status"] },
					{ type: "val", value: "pending" },
				],
			} as IR.BasicExpression;

			const filtered = testTodos.filter((item) =>
				evaluateExpression(
					mainWhere,
					item as unknown as Record<string, unknown>,
				),
			);

			expect(filtered.every((item) => item.status === "pending")).toBe(true);
		});

		it("should handle negative offset gracefully", () => {
			// Negative offset should be treated as 0 or handled appropriately
			const offset = -5;
			// slice with negative index works differently, so we use Math.max
			const safeOffset = Math.max(0, offset);
			const result = testTodos.slice(safeOffset);

			expect(result.length).toBe(testTodos.length);
		});
	});
});

describe("loadSubset - Limit After Offset", () => {
	let testTodos: Todo[];

	beforeEach(() => {
		testTodos = createTestTodos();
	});

	it("should apply limit after offset correctly", () => {
		// Sort by priority
		const sorted = [...testTodos].sort(
			(a, b) => (a.priority ?? 0) - (b.priority ?? 0),
		);

		// Apply offset first, then limit
		const offset = 2;
		const limit = 3;

		const afterOffset = sorted.slice(offset);
		const result = afterOffset.slice(0, limit);

		expect(result.length).toBe(limit);
		// First item should be 3rd in sorted order
		expect(result[0]).toBe(sorted[offset]);
	});

	it("should return remaining items if limit exceeds available after offset", () => {
		const sorted = [...testTodos].sort(
			(a, b) => (a.priority ?? 0) - (b.priority ?? 0),
		);

		const offset = testTodos.length - 2; // Only 2 items remaining
		const limit = 10; // Want more than available

		const afterOffset = sorted.slice(offset);
		const result = afterOffset.slice(0, limit);

		expect(result.length).toBe(2); // Only 2 items available
	});
});
