import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { RangeCondition } from "./sync-protocol";
import type { PartialSyncRowShape } from "./partial-sync-row-key";
import { partialSyncRowKey } from "./partial-sync-row-key";
import { matchesPredicate } from "./partial-sync-predicate-match";

/** Metadata on `rangePatch` when an update crosses client interest boundaries. */
export type PartialSyncViewTransition = "enterView" | "exitView";

export type PartialSyncPatchResult<TItem extends PartialSyncRowShape> = {
	change: SyncMessage<TItem>;
	viewTransition?: PartialSyncViewTransition;
};

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
	/** Predicate viewport wins over 1D sort windows so chunk sort keys do not widen visibility. */
	if (predicateGroups.length > 0) {
		return rowMatchesPredicateGroups(predicateGroups, row, getColumnValue);
	}
	if (sortRanges.length > 0) {
		return rowMatchesDeliveredSortRanges(sortRanges, row, getSortValue);
	}
	return false;
}

export type ClassifyPartialSyncRangePatchOptions = {
	/**
	 * When set, `delete` is only forwarded if the key was previously delivered to this client
	 * (viewport-scoped deletes). When omitted, `delete` is always forwarded (legacy behavior).
	 */
	deliveredRowIds?: ReadonlySet<string> | undefined;
};

/**
 * Maps a server-side change to a `rangePatch` payload, or `null` if this client should not
 * receive a patch. View enter/exit keeps the real `update` on the wire so clients can cache
 * rows and filter locally instead of fake delete/insert.
 */
export function classifyPartialSyncRangePatch<
	TItem extends PartialSyncRowShape,
>(
	sortRanges: DeliveredRange[],
	predicateGroups: RangeCondition[][],
	change: SyncMessage<TItem>,
	getSortValue: (row: TItem, column: string) => unknown,
	getColumnValue: (row: TItem, column: string) => unknown,
	options?: ClassifyPartialSyncRangePatchOptions,
): PartialSyncPatchResult<TItem> | null {
	const deliveredIds = options?.deliveredRowIds;
	if (change.type === "delete" && deliveredIds !== undefined) {
		return deliveredIds.has(String(partialSyncRowKey(change.key)))
			? { change }
			: null;
	}

	const hasInterest = sortRanges.length > 0 || predicateGroups.length > 0;
	if (!hasInterest) return null;

	if (change.type === "truncate") return { change };
	if (change.type === "delete") return { change };

	if (change.type === "insert") {
		return rowMatchesClientInterest(
			sortRanges,
			predicateGroups,
			change.value,
			getSortValue,
			getColumnValue,
		)
			? { change }
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
		if (newIn && oldIn) return { change };
		if (newIn && !oldIn) return { change, viewTransition: "enterView" };
		if (!newIn && oldIn) return { change, viewTransition: "exitView" };
		return null;
	}

	exhaustiveGuard(change);
}

/**
 * Filters sync messages to those relevant to a single predicate range (viewport). Used for
 * `rangeDelta` so clients never receive changelog rows outside their requested conditions.
 *
 * - `insert` / `update` / `truncate`: uses {@link classifyPartialSyncRangePatch} with only this
 *   predicate group (no sort ranges).
 * - `delete`: passed through unchanged — callers should filter deletes in the store when the
 *   deleted row snapshot is available (e.g. changelog payload).
 */
export function filterSyncMessagesForPredicateRange<
	TItem extends PartialSyncRowShape,
>(
	conditions: RangeCondition[],
	changes: SyncMessage<TItem>[],
	getSortValue: (row: TItem, column: string) => unknown,
	getColumnValue: (row: TItem, column: string) => unknown,
): SyncMessage<TItem>[] {
	const predicateGroups: RangeCondition[][] = [conditions];
	const sortRanges: DeliveredRange[] = [];
	const out: SyncMessage<TItem>[] = [];
	for (const change of changes) {
		if (change.type === "delete") {
			out.push(change);
			continue;
		}
		const patch = classifyPartialSyncRangePatch(
			sortRanges,
			predicateGroups,
			change,
			getSortValue,
			getColumnValue,
		);
		if (patch !== null) {
			out.push(patch.change);
		}
	}
	return out;
}
