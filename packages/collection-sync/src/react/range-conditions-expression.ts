import { and, eq, gt, gte, lt, lte, not, type Ref } from "@tanstack/db";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { PartialSyncRowShape } from "../partial-sync-row-key";
import type { RangeCondition } from "../sync-protocol";

/**
 * Row ref from `q.from({ items: collection }).where(({ items }) => …)`.
 * Column access must match {@link RangeCondition.column} names on the stored row shape.
 *
 * Uses TanStack {@link Ref} so column reads are `ExpressionLike` (e.g. for `inArray`), not `unknown`.
 */
export type PredicateRowRef = Ref<
	PartialSyncRowShape & Record<string, unknown>
>;

/**
 * Row accepted by {@link buildRangeConditionsAndExpression}: live query refs or plain objects (e.g. tests).
 * Dynamic `column` access yields `unknown`, which TanStack comparison helpers still accept.
 */
export type PredicateRangeBuildRow = PredicateRowRef | Record<string, unknown>;

/**
 * Builds a TanStack DB `where` expression AND-ing all conditions (same semantics as
 * {@link matchesPredicate} for plain property rows).
 */
export function buildRangeConditionsAndExpression(
	row: PredicateRangeBuildRow,
	conditions: RangeCondition[],
) {
	if (conditions.length === 0) {
		throw new Error(
			"buildRangeConditionsAndExpression: pass a non-empty conditions list",
		);
	}
	const parts = conditions.map((c) => rangeConditionExpression(row, c));
	if (parts.length === 1) {
		return parts[0];
	}
	const [a, b, ...rest] = parts;
	return rest.length === 0 ? and(a, b) : and(a, b, ...rest);
}

function rangeConditionExpression(
	row: PredicateRangeBuildRow,
	c: RangeCondition,
) {
	const col = row[c.column];
	switch (c.op) {
		case "eq":
			return eq(col, c.value);
		case "neq":
			return not(eq(col, c.value));
		case "gt":
			return gt(col, c.value);
		case "gte":
			return gte(col, c.value);
		case "lt":
			return lt(col, c.value);
		case "lte":
			return lte(col, c.value);
		case "between": {
			if (c.valueTo === undefined) {
				throw new Error(`between requires valueTo for column ${c.column}`);
			}
			return and(gte(col, c.value), lte(col, c.valueTo));
		}
		default:
			exhaustiveGuard(c.op);
	}
}
