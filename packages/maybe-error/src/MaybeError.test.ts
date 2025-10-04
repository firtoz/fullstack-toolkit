import { describe, expect, it } from "bun:test";
import {
	type AssumeSuccess,
	fail,
	type MaybeError,
	success,
} from "./MaybeError";

describe("MaybeError", () => {
	describe("success()", () => {
		it("should create a success with no value", () => {
			const result = success();

			expect(result.success).toBe(true);
			expect(result.result).toBeUndefined();
		});

		it("should create a success with a number value", () => {
			const result = success(42);

			expect(result.success).toBe(true);
			expect(result.result).toBe(42);
		});

		it("should create a success with a string value", () => {
			const result = success("hello");

			expect(result.success).toBe(true);
			expect(result.result).toBe("hello");
		});

		it("should create a success with an object value", () => {
			const obj = { name: "John", age: 30 };
			const result = success(obj);

			expect(result.success).toBe(true);
			expect(result.result).toEqual(obj);
			expect(result.result).toBe(obj); // Same reference
		});

		it("should create a success with null value", () => {
			const result = success(null);

			expect(result.success).toBe(true);
			expect(result.result).toBe(null);
		});

		it("should create a success with boolean value", () => {
			const resultTrue = success(true);
			const resultFalse = success(false);

			expect(resultTrue.success).toBe(true);
			expect(resultTrue.result).toBe(true);
			expect(resultFalse.success).toBe(true);
			expect(resultFalse.result).toBe(false);
		});

		it("should create a success with array value", () => {
			const arr = [1, 2, 3];
			const result = success(arr);

			expect(result.success).toBe(true);
			expect(result.result).toEqual(arr);
		});
	});

	describe("fail()", () => {
		it("should create a failure with string error", () => {
			const result = fail("Something went wrong");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Something went wrong");
		});

		it("should create a failure with number error", () => {
			const result = fail(404);

			expect(result.success).toBe(false);
			expect(result.error).toBe(404);
		});

		it("should create a failure with object error", () => {
			const error = { code: 500, message: "Internal server error" };
			const result = fail(error);

			expect(result.success).toBe(false);
			expect(result.error).toEqual(error);
		});

		it("should create a failure with Error instance", () => {
			const error = new Error("Custom error");
			const result = fail(error);

			expect(result.success).toBe(false);
			expect(result.error).toBe(error);
			expect(result.error.message).toBe("Custom error");
		});

		it("should create a failure with custom error class", () => {
			class CustomError extends Error {
				constructor(
					message: string,
					public code: number,
				) {
					super(message);
				}
			}

			const error = new CustomError("Not found", 404);
			const result = fail(error);

			expect(result.success).toBe(false);
			expect(result.error).toBe(error);
			expect(result.error.code).toBe(404);
		});
	});

	describe("Type guards and discriminated unions", () => {
		it("should narrow type correctly with success check", () => {
			const result: MaybeError<number, string> = success(42) as MaybeError<
				number,
				string
			>;

			if (result.success) {
				// TypeScript should know result.result is number
				expect(result.result).toBe(42);
				// This should compile without error
				const doubled: number = result.result * 2;
				expect(doubled).toBe(84);
			} else {
				// Should not reach here
				expect(true).toBe(false);
			}
		});

		it("should narrow type correctly with error check", () => {
			const result: MaybeError<number, string> = fail(
				"Error occurred",
			) as MaybeError<number, string>;

			if (!result.success) {
				// TypeScript should know result.error is string
				expect(result.error).toBe("Error occurred");
				// This should compile without error
				const upperError: string = result.error.toUpperCase();
				expect(upperError).toBe("ERROR OCCURRED");
			} else {
				// Should not reach here
				expect(true).toBe(false);
			}
		});

		it("should handle success in else branch", () => {
			const result: MaybeError<string, number> = success("hello") as MaybeError<
				string,
				number
			>;

			if (result.success) {
				expect(result.result).toBe("hello");
			} else {
				// Should not reach here
				expect(true).toBe(false);
			}
		});

		it("should handle error in if branch", () => {
			const result: MaybeError<string, number> = fail(500) as MaybeError<
				string,
				number
			>;

			if (result.success) {
				// Should not reach here
				expect(true).toBe(false);
			} else {
				expect(result.error).toBe(500);
			}
		});
	});

	describe("Real-world usage examples", () => {
		type User = { id: string; name: string; email: string };
		type ApiError = { code: number; message: string };

		function divide(a: number, b: number): MaybeError<number, string> {
			if (b === 0) return fail("Division by zero");
			return success(a / b);
		}

		function parseJSON<T>(json: string): MaybeError<T, string> {
			try {
				const parsed = JSON.parse(json);
				return success(parsed);
			} catch (error) {
				return fail(
					`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		async function fetchUser(id: string): Promise<MaybeError<User, ApiError>> {
			// Simulated API call
			if (id === "invalid") {
				return fail({ code: 404, message: "User not found" });
			}
			if (id === "error") {
				return fail({ code: 500, message: "Internal server error" });
			}
			return success({
				id,
				name: "John Doe",
				email: "john@example.com",
			});
		}

		it("should handle division by zero", () => {
			const result = divide(10, 0);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe("Division by zero");
			}
		});

		it("should handle successful division", () => {
			const result = divide(10, 2);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.result).toBe(5);
			}
		});

		it("should handle valid JSON parsing", () => {
			const json = '{"name": "John", "age": 30}';
			const result = parseJSON<{ name: string; age: number }>(json);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.result.name).toBe("John");
				expect(result.result.age).toBe(30);
			}
		});

		it("should handle invalid JSON parsing", () => {
			const json = "{ invalid json }";
			const result = parseJSON(json);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("Invalid JSON");
			}
		});

		it("should handle successful async user fetch", async () => {
			const result = await fetchUser("123");

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.result.id).toBe("123");
				expect(result.result.name).toBe("John Doe");
				expect(result.result.email).toBe("john@example.com");
			}
		});

		it("should handle 404 user not found", async () => {
			const result = await fetchUser("invalid");

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(404);
				expect(result.error.message).toBe("User not found");
			}
		});

		it("should handle 500 server error", async () => {
			const result = await fetchUser("error");

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(500);
				expect(result.error.message).toBe("Internal server error");
			}
		});
	});

	describe("Chaining and composition", () => {
		function validateAge(age: number): MaybeError<number, string> {
			if (age < 0) return fail("Age cannot be negative");
			if (age > 150) return fail("Age too large");
			return success(age);
		}

		function categorizeAge(
			age: number,
		): MaybeError<"child" | "adult" | "senior", string> {
			if (age < 18) return success("child");
			if (age < 65) return success("adult");
			return success("senior");
		}

		it("should chain validations successfully", () => {
			const ageResult = validateAge(30);

			expect(ageResult.success).toBe(true);

			if (ageResult.success) {
				const categoryResult = categorizeAge(ageResult.result);
				expect(categoryResult.success).toBe(true);
				if (categoryResult.success) {
					expect(categoryResult.result).toBe("adult");
				}
			}
		});

		it("should stop chain on validation error", () => {
			const ageResult = validateAge(-5);

			expect(ageResult.success).toBe(false);

			if (!ageResult.success) {
				expect(ageResult.error).toBe("Age cannot be negative");
				// Don't proceed to categorize
			}
		});

		it("should handle multiple validation steps", () => {
			const ages = [10, 30, 70, -5, 200];
			const results = ages.map((age) => {
				const validated = validateAge(age);
				if (!validated.success) return validated;
				return categorizeAge(validated.result);
			});

			expect(results[0].success).toBe(true);
			if (results[0].success) expect(results[0].result).toBe("child");

			expect(results[1].success).toBe(true);
			if (results[1].success) expect(results[1].result).toBe("adult");

			expect(results[2].success).toBe(true);
			if (results[2].success) expect(results[2].result).toBe("senior");

			expect(results[3].success).toBe(false);
			if (!results[3].success)
				expect(results[3].error).toBe("Age cannot be negative");

			expect(results[4].success).toBe(false);
			if (!results[4].success) expect(results[4].error).toBe("Age too large");
		});
	});

	describe("Type utilities", () => {
		it("should work with AssumeSuccess type utility", () => {
			type UserResult = MaybeError<{ id: string; name: string }, string>;
			type User = AssumeSuccess<UserResult>;

			const result: UserResult = success({ id: "1", name: "John" });

			if (result.success) {
				// User type should be { id: string; name: string }
				const user: User = result.result;
				expect(user.id).toBe("1");
				expect(user.name).toBe("John");
			}
		});
	});

	describe("Edge cases", () => {
		it("should handle zero as success value", () => {
			const result = success(0);

			expect(result.success).toBe(true);
			expect(result.result).toBe(0);
		});

		it("should handle empty string as success value", () => {
			const result = success("");

			expect(result.success).toBe(true);
			expect(result.result).toBe("");
		});

		it("should handle empty string as error value", () => {
			const result = fail("");

			expect(result.success).toBe(false);
			expect(result.error).toBe("");
		});

		it("should handle nested MaybeError as value", () => {
			const inner = success(42);
			const outer = success(inner);

			expect(outer.success).toBe(true);
			if (outer.success) {
				expect(outer.result.success).toBe(true);
				if (outer.result.success) {
					expect(outer.result.result).toBe(42);
				}
			}
		});
	});
});
