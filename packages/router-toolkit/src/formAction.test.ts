import { describe, expect, expectTypeOf, it } from "bun:test";
import { z } from "zod";
import type { $ZodErrorTree } from "zod/v4/core";

function assert(expression: unknown): asserts expression {
	expect(expression).toBeTruthy();
}

const checkError = <TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	data: unknown,
	error: $ZodErrorTree<z.infer<TSchema>>,
) => {
	const result = z.safeParse(schema, data);
	assert(!result.success);
	assert(result.error);
	const tree = z.treeifyError(result.error);
	expect(tree).toEqual(error);
};

describe("z.treeifyError", () => {
	it("should return a tree of errors", () => {
		const testSchema = z.object({
			name: z.string().min(5),
			email: z.string().email(),
		});

		const testResult = z.safeParse(testSchema, {
			// name: "John Doe",
			email: "john.doe@example.com",
		});

		assert(!testResult.success);
		assert(testResult.error);

		const tree = z.treeifyError(testResult.error);

		expectTypeOf(tree).toEqualTypeOf<{
			errors: string[];
			properties?: {
				name?: {
					errors: string[];
				};
				email?: {
					errors: string[];
				};
			};
		}>();

		expect(tree).toEqual({
			errors: [],
			properties: {
				name: {
					errors: ["Invalid input: expected string, received undefined"],
				},
			},
		});

		checkError(
			testSchema,
			{
				name: "john",
			},
			{
				errors: [],
				properties: {
					email: {
						errors: ["Invalid input: expected string, received undefined"],
					},
					name: {
						errors: ["Too small: expected string to have >=5 characters"],
					},
				},
			},
		);
	});
});
