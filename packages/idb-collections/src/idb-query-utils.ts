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
		let comparisons: ReturnType<typeof extractSimpleComparisons>;
		try {
			comparisons = extractSimpleComparisons(expression);
		} catch {
			// e.g. `like` and other ops TanStack does not decompose here — fall back to full scan + filter
			if (debug) {
				console.warn(
					"Indexed query extraction skipped: expression not supported by extractSimpleComparisons",
				);
			}
			return null;
		}

		if (comparisons.length !== 1) {
			return null;
		}

		const comparison = comparisons[0];
		const fieldName = comparison.field.join(".");
		const lastIdx = comparison.field.length - 1;
		const lastSegment = lastIdx >= 0 ? (comparison.field[lastIdx] ?? "") : "";
		// TanStack may use nested refs (`todo.priority`); IDB indexes are keyed by column (e.g. `priority`)
		const indexName = indexes[fieldName] ?? indexes[lastSegment];

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
		if (debug) {
			console.warn("Error extracting indexed query", error, expression);
		}
		return null;
	}
}
