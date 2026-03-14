import type { IR } from "@tanstack/db";
import { extractSimpleComparisons } from "@tanstack/db";

/**
 * Key range specification for index queries.
 * Used by IndexedDB implementations to build IDBKeyRange objects.
 */
export interface KeyRangeSpec {
	type: "only" | "lowerBound" | "upperBound" | "bound";
	value?: unknown;
	lower?: unknown;
	upper?: unknown;
	lowerOpen?: boolean;
	upperOpen?: boolean;
}

/**
 * Attempts to extract a simple indexed query from an IR expression.
 * Returns the field name and key range if the query can be optimized.
 *
 * IndexedDB indexes are much more limited than SQL WHERE clauses:
 * - Only supports simple comparisons on a SINGLE indexed field
 * - Supported operators: eq, gt, gte, lt, lte
 * - Complex queries (AND, OR, NOT, multiple fields) fall back to in-memory filtering
 */
export function tryExtractIndexedQuery(
	expression: IR.BasicExpression,
	indexes?: Record<string, string>,
	debug?: boolean,
): { fieldName: string; indexName: string; keyRange: KeyRangeSpec } | null {
	if (!indexes) {
		return null;
	}

	try {
		const comparisons = extractSimpleComparisons(expression);

		if (comparisons.length !== 1) {
			return null;
		}

		const comparison = comparisons[0];
		const fieldName = comparison.field.join(".");
		const indexName = indexes[fieldName];

		if (!indexName) {
			return null;
		}

		let keyRange: KeyRangeSpec | null = null;

		switch (comparison.operator) {
			case "eq":
				keyRange = { type: "only", value: comparison.value };
				break;
			case "gt":
				keyRange = {
					type: "lowerBound",
					lower: comparison.value,
					lowerOpen: true,
				};
				break;
			case "gte":
				keyRange = {
					type: "lowerBound",
					lower: comparison.value,
					lowerOpen: false,
				};
				break;
			case "lt":
				keyRange = {
					type: "upperBound",
					upper: comparison.value,
					upperOpen: true,
				};
				break;
			case "lte":
				keyRange = {
					type: "upperBound",
					upper: comparison.value,
					upperOpen: false,
				};
				break;
			default:
				if (debug) {
					console.warn(
						`Skipping indexed query extraction for unsupported operator: ${comparison.operator}`,
					);
				}
				return null;
		}

		if (!keyRange) {
			return null;
		}

		return { fieldName, indexName, keyRange };
	} catch (error) {
		console.error("Error extracting indexed query", error, expression);
		return null;
	}
}
