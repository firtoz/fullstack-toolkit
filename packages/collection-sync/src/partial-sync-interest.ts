import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { RangeCondition } from "./sync-protocol";
import {
	partialSyncRowKey,
	type PartialSyncRowId,
} from "./partial-sync-row-key";
import { matchesPredicate } from "./partial-sync-predicate-match";

/** Tracked 1D sort interval delivered to a client (index / cursor queries). */
export type DeliveredRange = {
	sortColumn: string;
	sortDirection: "asc" | "desc";
	fromValue: unknown;
	toValue: unknown;
};

export function compareInterestValues(left: unknown, right: unknown): number {
	const leftValue = left instanceof Date ? left.getTime() : left;
	const rightValue = right instanceof Date ? right.getTime() : right;
	if (typeof leftValue === "number" && typeof rightValue === "number") {
		return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
	}
	const leftString = String(leftValue);
	const rightString = String(rightValue);
	return leftString.localeCompare(rightString);
}

export function sortValueWithinDeliveredRange(
	value: unknown,
	range: DeliveredRange,
): boolean {
	if (value === undefined || value === null) return false;
	const compareFrom = compareInterestValues(value, range.fromValue);
	const compareTo = compareInterestValues(value, range.toValue);
	if (range.sortDirection === "asc") {
		return compareFrom >= 0 && compareTo <= 0;
	}
	return compareFrom <= 0 && compareTo >= 0;
}

export function rowMatchesDeliveredSortRanges<TItem>(
	ranges: DeliveredRange[],
	row: TItem,
	getSortValue: (row: TItem, column: string) => unknown,
): boolean {
	if (ranges.length === 0) return false;
	return ranges.some((range) => {
		const sortValue = getSortValue(row, range.sortColumn);
		return sortValueWithinDeliveredRange(sortValue, range);
	});
}

export function rowMatchesPredicateGroups<TItem>(
	predicateGroups: RangeCondition[][],
	row: TItem,
	getColumnValue: (row: TItem, column: string) => unknown,
): boolean {
	if (predicateGroups.length === 0) return false;
	return predicateGroups.some((group) =>
		matchesPredicate(row, group, getColumnValue),
	);
}

export function rowMatchesClientInterest<TItem>(
	sortRanges: DeliveredRange[],
	predicateGroups: RangeCondition[][],
	row: TItem,
	getSortValue: (row: TItem, column: string) => unknown,
	getColumnValue: (row: TItem, column: string) => unknown,
): boolean {
	const inSort = rowMatchesDeliveredSortRanges(sortRanges, row, getSortValue);
	const inPred = rowMatchesPredicateGroups(
		predicateGroups,
		row,
		getColumnValue,
	);
	return inSort || inPred;
}

/**
 * Maps a server-side change to the {@link SyncMessage} that should be sent as a `rangePatch`,
 * or `null` if this client should not receive a patch.
 */
export function classifyPartialSyncRangePatch<TItem extends { id: PartialSyncRowId }>(
	sortRanges: DeliveredRange[],
	predicateGroups: RangeCondition[][],
	change: SyncMessage<TItem>,
	getSortValue: (row: TItem, column: string) => unknown,
	getColumnValue: (row: TItem, column: string) => unknown,
): SyncMessage<TItem> | null {
	const hasInterest =
		sortRanges.length > 0 || predicateGroups.length > 0;
	if (!hasInterest) return null;

	if (change.type === "truncate") return change;
	if (change.type === "delete") return change;

	if (change.type === "insert") {
		return rowMatchesClientInterest(
			sortRanges,
			predicateGroups,
			change.value,
			getSortValue,
			getColumnValue,
		)
			? change
			: null;
	}

	if (change.type === "update") {
		const newIn = rowMatchesClientInterest(
			sortRanges,
			predicateGroups,
			change.value,
			getSortValue,
			getColumnValue,
		);
		const oldIn =
			change.previousValue !== undefined
				? rowMatchesClientInterest(
						sortRanges,
						predicateGroups,
						change.previousValue,
						getSortValue,
						getColumnValue,
					)
				: false;
		if (newIn && oldIn) return change;
		if (newIn && !oldIn) return { type: "insert", value: change.value };
		if (!newIn && oldIn) {
			return {
				type: "delete",
				key: partialSyncRowKey(change.value.id),
			};
		}
		return null;
	}

	exhaustiveGuard(change);
}
