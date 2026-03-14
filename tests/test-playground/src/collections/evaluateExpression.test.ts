/**
 * Unit tests for evaluateExpression function
 * Tests the actual implementation of expression evaluation in IndexedDB collections
 */

import { describe, it, expect, beforeEach } from "vitest";
import { evaluateExpression, getExpressionValue } from "@firtoz/db-helpers";
import type { IR } from "@tanstack/db";
import { createTestTodos } from "../test-utils/collection-test-utils";
import type { Todo } from "test-schema/schema";

describe("evaluateExpression - Unit Tests", () => {
	let testItem: Todo;

	beforeEach(() => {
		const todos = createTestTodos();
		testItem = todos[2]; // Item 3: priority 10, status 'pending'
	});

	describe("Basic Operators", () => {
		it("should evaluate eq (equals) operator", () => {
			const expression = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["priority"] },
					{ type: "val", value: 10 },
				],
			} as IR.Func;

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(true);

			const expressionFalse: IR.Func = {
				type: "func",
				name: "eq",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 5 } as IR.Value,
				],
			} as IR.Func;

			const resultFalse = evaluateExpression(expressionFalse, testItem);
			expect(resultFalse).toBe(false);
		});

		it("should evaluate ne (not equals) operator", () => {
			const expression = {
				type: "func",
				name: "ne",
				args: [
					{ type: "ref", path: ["status"] } as IR.PropRef,
					{ type: "val", value: "done" } as IR.Value,
				],
			} as IR.Func;

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(true); // status is 'pending', not 'done'
		});

		it("should evaluate gt (greater than) operator", () => {
			const expression = {
				type: "func",
				name: "gt",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 5 } as IR.Value,
				],
			} as IR.Func;

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(true); // 10 > 5
		});

		it("should evaluate gte (greater than or equal) operator", () => {
			const expression = {
				type: "func",
				name: "gte",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 10 } as IR.Value,
				],
			} as IR.Func;

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(true); // 10 >= 10
		});

		it("should evaluate lt (less than) operator", () => {
			const expression = {
				type: "func",
				name: "lt",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 5 } as IR.Value,
				],
			} as IR.Func;

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(false); // 10 < 5 is false
		});

		it("should evaluate lte (less than or equal) operator", () => {
			const expression = {
				type: "func",
				name: "lte",
				args: [
					{ type: "ref", path: ["priority"] } as IR.PropRef,
					{ type: "val", value: 10 } as IR.Value,
				],
			} as IR.Func;

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(true); // 10 <= 10
		});
	});

	describe("Logical Operators", () => {
		it("should evaluate and operator", () => {
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

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(true); // priority > 5 AND status = 'pending'
		});

		it("should evaluate or operator", () => {
			const expression = {
				type: "func",
				name: "or",
				args: [
					{
						type: "func",
						name: "eq",
						args: [
							{ type: "ref", path: ["status"] } as IR.PropRef,
							{ type: "val", value: "done" } as IR.Value,
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

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(true); // status = 'done' OR status = 'pending' (second is true)
		});

		it("should evaluate not operator", () => {
			const expression = {
				type: "func",
				name: "not",
				args: [
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

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(true); // NOT (status = 'done') is true
		});
	});

	describe("Null Checks", () => {
		it("should evaluate isNull operator", () => {
			const testItemWithNull = { ...testItem, tags: null };

			const expression = {
				type: "func",
				name: "isNull",
				args: [{ type: "ref", path: ["tags"] } as IR.PropRef],
			} as IR.Func;

			const result = evaluateExpression(expression, testItemWithNull);
			expect(result).toBe(true);
		});

		it("should evaluate isNotNull operator", () => {
			const expression = {
				type: "func",
				name: "isNotNull",
				args: [{ type: "ref", path: ["priority"] } as IR.PropRef],
			} as IR.Func;

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(true); // priority is not null
		});

		it("should evaluate isUndefined operator", () => {
			const testItemWithUndefined = { ...testItem, tags: undefined };

			const expression = {
				type: "func",
				name: "isUndefined",
				args: [{ type: "ref", path: ["tags"] } as IR.PropRef],
			} as IR.Func;

			const result = evaluateExpression(expression, testItemWithUndefined);
			expect(result).toBe(true);
		});
	});

	describe("String Operators", () => {
		it("should evaluate like operator (case-sensitive)", () => {
			const testItemWithContent = { ...testItem, content: "Super task" };

			const expression = {
				type: "func",
				name: "like",
				args: [
					{ type: "ref", path: ["content"] } as IR.PropRef,
					{ type: "val", value: "%Super%" } as IR.Value,
				],
			} as IR.Func;

			const result = evaluateExpression(expression, testItemWithContent);
			expect(result).toBe(true);

			// Should be case-sensitive
			const expressionLower: IR.Func = {
				type: "func",
				name: "like",
				args: [
					{ type: "ref", path: ["content"] } as IR.PropRef,
					{ type: "val", value: "%super%" } as IR.Value,
				],
			} as IR.Func;

			const resultLower = evaluateExpression(
				expressionLower,
				testItemWithContent,
			);
			expect(resultLower).toBe(false); // 'Super' !== 'super'
		});

		it("should evaluate ilike operator (case-insensitive)", () => {
			const testItemWithContent = { ...testItem, content: "Super task" };

			const expression = {
				type: "func",
				name: "ilike",
				args: [
					{ type: "ref", path: ["content"] } as IR.PropRef,
					{ type: "val", value: "%super%" } as IR.Value,
				],
			} as IR.Func;

			const result = evaluateExpression(expression, testItemWithContent);
			expect(result).toBe(true); // Case-insensitive match
		});

		it("should handle LIKE patterns with _ (single character)", () => {
			const testItemWithContent = { ...testItem, content: "task" };

			const expression = {
				type: "func",
				name: "like",
				args: [
					{ type: "ref", path: ["content"] } as IR.PropRef,
					{ type: "val", value: "t_sk" } as IR.Value, // _ matches 'a'
				],
			} as IR.Func;

			const result = evaluateExpression(expression, testItemWithContent);
			expect(result).toBe(true);
		});
	});

	describe("Array Operators", () => {
		it("should evaluate in operator", () => {
			const expression = {
				type: "func",
				name: "in",
				args: [
					{ type: "ref", path: ["status"] } as IR.PropRef,
					{
						type: "val",
						value: ["pending", "done", "in-progress"],
					} as IR.Value,
				],
			} as IR.Func;

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(true); // 'pending' is in array
		});

		it("should handle in operator with no match", () => {
			const expression = {
				type: "func",
				name: "in",
				args: [
					{ type: "ref", path: ["status"] } as IR.PropRef,
					{ type: "val", value: ["done", "cancelled"] } as IR.Value,
				],
			} as IR.Func;

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(false); // 'pending' is not in array
		});
	});

	describe("Complex Nested Expressions", () => {
		it("should evaluate deeply nested AND/OR expressions", () => {
			const expression = {
				type: "func",
				name: "or",
				args: [
					{
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
					} as IR.Func,
					{
						type: "func",
						name: "eq",
						args: [
							{ type: "ref", path: ["completed"] } as IR.PropRef,
							{ type: "val", value: true } as IR.Value,
						],
					} as IR.Func,
				],
			} as IR.Func;

			const result = evaluateExpression(expression, testItem);
			expect(result).toBe(true); // (priority > 5 AND status = 'pending') OR completed = true
		});
	});

	describe("getExpressionValue", () => {
		it("should get value from ref expression", () => {
			const expression = {
				type: "ref",
				path: ["priority"],
			} as IR.PropRef;

			const value = getExpressionValue(expression, testItem);
			expect(value).toBe(10);
		});

		it("should get value from val expression", () => {
			const expression = {
				type: "val",
				value: 42,
			} as IR.Value;

			const value = getExpressionValue(expression, testItem);
			expect(value).toBe(42);
		});

		it("should throw error for unsupported expression type", () => {
			const expression = {
				type: "unknown",
			} as unknown as IR.BasicExpression;

			expect(() => getExpressionValue(expression, testItem)).toThrow(
				"Cannot get value from expression type: unknown",
			);
		});
	});

	describe("Error Handling", () => {
		it("should throw error for unsupported function", () => {
			const expression = {
				type: "func",
				name: "unsupported",
				args: [],
			} as unknown as IR.Func;

			expect(() => evaluateExpression(expression, testItem)).toThrow(
				"Unsupported function: unsupported",
			);
		});

		it("should throw error for unsupported expression type", () => {
			const expression = {
				type: "unknown",
			} as unknown as IR.BasicExpression;

			expect(() => evaluateExpression(expression, testItem)).toThrow(
				"Unsupported expression type: unknown",
			);
		});
	});
});
