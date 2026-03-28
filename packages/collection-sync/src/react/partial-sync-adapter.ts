import type { PartialSyncRowShape } from "../partial-sync-row-key";
import type { RangeCondition, SyncRangeSort } from "../sync-protocol";

/** Row shape compatible with partial-sync viewport hooks (matches {@link PartialSyncItem}). */
export type PartialSyncViewportItem = PartialSyncRowShape;

export type PredicateSortSpec<TSortColumn extends string> = {
	column: TSortColumn;
	direction: SyncRangeSort["direction"];
};

/**
 * Bundles predicate ↔ viewport mapping, optional prefetch expansion, and sort accessors for
 * {@link usePartialSyncViewport} + {@link usePredicateFilteredRows}.
 */
export type PartialSyncViewportAdapter<
	TItem extends PartialSyncViewportItem,
	TViewport,
	TSortColumn extends keyof TItem & string,
> = {
	toConditions: (viewport: TViewport) => RangeCondition[];
	expandViewport: (viewport: TViewport, pad: number) => TViewport;
	sort: PredicateSortSpec<TSortColumn>;
	getSortValue: (row: TItem, column: TSortColumn) => unknown;
};

export type CreatePartialSyncAdapterConfig<
	TItem extends PartialSyncViewportItem,
	TViewport,
	TSortColumn extends keyof TItem & string,
> = {
	toConditions: (viewport: TViewport) => RangeCondition[];
	/** Widen viewport before server `rangeQuery`. Default: identity (no prefetch). */
	expandViewport?: (viewport: TViewport, pad: number) => TViewport;
	sort: PredicateSortSpec<TSortColumn>;
	getSortValue: (row: TItem, column: TSortColumn) => unknown;
};

export function createPartialSyncAdapter<
	TItem extends PartialSyncViewportItem,
	TViewport,
	TSortColumn extends keyof TItem & string,
>(
	config: CreatePartialSyncAdapterConfig<TItem, TViewport, TSortColumn>,
): PartialSyncViewportAdapter<TItem, TViewport, TSortColumn> {
	return {
		toConditions: config.toConditions,
		expandViewport: config.expandViewport ?? ((v) => v),
		sort: config.sort,
		getSortValue: config.getSortValue,
	};
}

export type NumericAxisSpec<TViewport> = {
	readonly column: string;
	readonly min: (viewport: TViewport) => number;
	readonly max: (viewport: TViewport) => number;
};

/**
 * Builds `between` {@link RangeCondition}s from numeric axis accessors (N-D box / interval per column).
 */
export function betweenConditionsForNumericAxes<TViewport>(
	viewport: TViewport,
	axes: readonly NumericAxisSpec<TViewport>[],
): RangeCondition[] {
	return axes.map((axis) => ({
		column: axis.column,
		op: "between" as const,
		value: axis.min(viewport),
		valueTo: axis.max(viewport),
	}));
}
