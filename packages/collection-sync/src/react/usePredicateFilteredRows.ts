import { inArray } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import { DEFAULT_PAGE_LIMIT } from "./constants";
import {
	buildRangeConditionsAndExpression,
	type PredicateRowRef,
} from "./range-conditions-expression";
import type { PartialSyncItem, UsePredicateFilteredRowsOptions } from "./types";

const PIN_IDS_SEP = "\u0000";

function compareByPartialSort<
	TItem extends PartialSyncItem,
	TSortColumn extends keyof TItem & string,
>(
	a: TItem,
	b: TItem,
	sort: { column: TSortColumn; direction: "asc" | "desc" },
	getSortValue: (row: TItem, column: TSortColumn) => unknown,
): number {
	const va = getSortValue(a, sort.column);
	const vb = getSortValue(b, sort.column);
	let primary = 0;
	if (typeof va === "number" && typeof vb === "number") {
		if (va < vb) primary = -1;
		else if (va > vb) primary = 1;
	} else {
		const sa = String(va);
		const sb = String(vb);
		if (sa < sb) primary = -1;
		else if (sa > sb) primary = 1;
	}
	if (primary !== 0) {
		return sort.direction === "desc" ? -primary : primary;
	}
	return String(a.id).localeCompare(String(b.id));
}

/**
 * Reactive predicate filter + sort + limit via TanStack DB `useLiveQuery` (IVM), instead of
 * scanning the whole collection on each change.
 */
export function usePredicateFilteredRows<
	TItem extends PartialSyncItem,
	TSortColumn extends keyof TItem & string,
>({
	collection,
	conditions,
	sort,
	getSortValue,
	getColumnValue: _getColumnValue,
	limit = DEFAULT_PAGE_LIMIT,
	cacheDisplayMode = "immediate",
	confirmedRowKeys,
	confirmedKeysRevision = 0,
	alwaysIncludeRowIds,
}: UsePredicateFilteredRowsOptions<TItem, TSortColumn>): TItem[] {
	void _getColumnValue;

	const conditionsKey = useMemo(() => JSON.stringify(conditions), [conditions]);

	const pinIdsSerialized =
		alwaysIncludeRowIds === undefined || alwaysIncludeRowIds.length === 0
			? ""
			: [...new Set([...alwaysIncludeRowIds].map(String))]
					.sort()
					.join(PIN_IDS_SEP);

	const { data } = useLiveQuery(
		(q) => {
			if (
				cacheDisplayMode === "confirmed" &&
				(confirmedRowKeys === undefined || confirmedRowKeys.size === 0)
			) {
				return null;
			}

			let query = q.from({ items: collection });

			if (conditions.length > 0) {
				query = query.where((refs) =>
					buildRangeConditionsAndExpression(
						refs.items as PredicateRowRef,
						conditions,
					),
				);
			}

			if (cacheDisplayMode === "confirmed" && confirmedRowKeys !== undefined) {
				const keys = [...confirmedRowKeys];
				query = query.where((refs) =>
					inArray((refs.items as PredicateRowRef).id, keys),
				);
			}

			query = query.orderBy(
				(refs) => (refs.items as PredicateRowRef)[sort.column],
				sort.direction,
			);
			return query.limit(limit);
		},
		[
			collection,
			conditionsKey,
			sort.column,
			sort.direction,
			limit,
			cacheDisplayMode,
			confirmedKeysRevision,
			confirmedRowKeys,
		],
	);

	const { data: pinnedData } = useLiveQuery(
		(q) => {
			if (pinIdsSerialized === "") return null;
			if (
				cacheDisplayMode === "confirmed" &&
				(confirmedRowKeys === undefined || confirmedRowKeys.size === 0)
			) {
				return null;
			}

			const pinKeys = pinIdsSerialized.split(PIN_IDS_SEP);

			let query = q.from({ items: collection });

			if (cacheDisplayMode === "confirmed" && confirmedRowKeys !== undefined) {
				const keys = [...confirmedRowKeys];
				query = query.where((refs) =>
					inArray((refs.items as PredicateRowRef).id, keys),
				);
			}

			query = query.where((refs) =>
				inArray((refs.items as PredicateRowRef).id, pinKeys),
			);

			query = query.orderBy(
				(refs) => (refs.items as PredicateRowRef)[sort.column],
				sort.direction,
			);
			return query.limit(pinKeys.length);
		},
		[
			collection,
			pinIdsSerialized,
			sort.column,
			sort.direction,
			cacheDisplayMode,
			confirmedKeysRevision,
			confirmedRowKeys,
		],
	);

	const predicateRows = (data ?? []) as TItem[];
	const pinnedRows = (pinnedData ?? []) as TItem[];

	return useMemo(() => {
		if (pinIdsSerialized === "") return predicateRows;
		const map = new Map<string, TItem>();
		for (const r of predicateRows) map.set(String(r.id), r);
		for (const r of pinnedRows) map.set(String(r.id), r);
		const merged = [...map.values()];
		merged.sort((a, b) => compareByPartialSort(a, b, sort, getSortValue));
		return merged;
	}, [predicateRows, pinnedRows, pinIdsSerialized, sort, getSortValue]);
}
