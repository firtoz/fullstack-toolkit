import { inArray } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import { DEFAULT_PAGE_LIMIT } from "./constants";
import {
	buildRangeConditionsAndExpression,
	type PredicateRowRef,
} from "./range-conditions-expression";
import type { PartialSyncItem, UsePredicateFilteredRowsOptions } from "./types";

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
	getSortValue: _getSortValue,
	getColumnValue: _getColumnValue,
	limit = DEFAULT_PAGE_LIMIT,
	cacheDisplayMode = "immediate",
	confirmedRowKeys,
	confirmedKeysRevision = 0,
}: UsePredicateFilteredRowsOptions<TItem, TSortColumn>): TItem[] {
	void _getSortValue;
	void _getColumnValue;

	const conditionsKey = useMemo(() => JSON.stringify(conditions), [conditions]);

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

	return (data ?? []) as TItem[];
}
