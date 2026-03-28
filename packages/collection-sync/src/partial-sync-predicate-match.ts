import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { RangeCondition } from "./sync-protocol";

function compareUnknown(a: unknown, b: unknown): number {
	const na = a instanceof Date ? a.getTime() : a;
	const nb = b instanceof Date ? b.getTime() : b;
	if (typeof na === "number" && typeof nb === "number") {
		if (na === nb) return 0;
		return na < nb ? -1 : 1;
	}
	return String(na).localeCompare(String(nb));
}

export function defaultPredicateColumnValue<TItem>(
	row: TItem,
	column: string,
): unknown {
	if (row !== null && typeof row === "object" && column in row) {
		return (row as Record<string, unknown>)[column];
	}
	return undefined;
}

export function matchesPredicate<TItem>(
	row: TItem,
	conditions: RangeCondition[],
	getColumnValue: (row: TItem, column: string) => unknown,
): boolean {
	for (const c of conditions) {
		const v = getColumnValue(row, c.column);
		switch (c.op) {
			case "eq":
				if (compareUnknown(v, c.value) !== 0) return false;
				break;
			case "neq":
				if (compareUnknown(v, c.value) === 0) return false;
				break;
			case "gt":
				if (compareUnknown(v, c.value) <= 0) return false;
				break;
			case "gte":
				if (compareUnknown(v, c.value) < 0) return false;
				break;
			case "lt":
				if (compareUnknown(v, c.value) >= 0) return false;
				break;
			case "lte":
				if (compareUnknown(v, c.value) > 0) return false;
				break;
			case "between": {
				if (c.valueTo === undefined) return false;
				if (
					compareUnknown(v, c.value) < 0 ||
					compareUnknown(v, c.valueTo) > 0
				) {
					return false;
				}
				break;
			}
			default:
				exhaustiveGuard(c.op);
		}
	}
	return true;
}
