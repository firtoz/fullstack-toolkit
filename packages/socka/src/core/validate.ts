import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Validates {@link value} with a Standard Schema v1 schema and returns the output,
 * or throws an {@link Error} whose message aggregates issue messages.
 */
export async function parseStandardSchema<T>(
	schema: StandardSchemaV1<unknown, T>,
	value: unknown,
): Promise<T> {
	const result = await schema["~standard"].validate(value);
	if (result.issues) {
		const messages = result.issues.map((issue) => issue.message).join("; ");
		throw new Error(messages || "Validation failed");
	}
	return result.value;
}
