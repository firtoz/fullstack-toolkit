import { useEffect, useMemo, useState } from "react";
import {
	defaultPredicateColumnValue,
	matchesPredicate,
} from "./partial-sync-utils";
import { DEFAULT_PAGE_LIMIT } from "./constants";
import type { PartialSyncItem, UsePredicateFilteredRowsOptions } from "./types";

export function usePredicateFilteredRows<
	TItem extends PartialSyncItem,
	TSortColumn extends keyof TItem & string,
>({
	collection,
	conditions,
	sort,
	getSortValue,
	getColumnValue = defaultPredicateColumnValue,
	limit = DEFAULT_PAGE_LIMIT,
}: UsePredicateFilteredRowsOptions<TItem, TSortColumn>): TItem[] {
	const [collectionVersion, setCollectionVersion] = useState(0);
	useEffect(() => {
		const sub = collection.subscribeChanges(() => {
			setCollectionVersion((v) => v + 1);
		});
		return () => {
			sub.unsubscribe();
		};
	}, [collection]);
	return useMemo(() => {
		void collectionVersion;
		const out: TItem[] = [];
		for (const [, row] of collection.entries()) {
			if (matchesPredicate(row, conditions, getColumnValue)) {
				out.push(row);
			}
		}
		out.sort((a, b) => {
			const av = getSortValue(a, sort.column);
			const bv = getSortValue(b, sort.column);
			const cmp =
				typeof av === "number" && typeof bv === "number"
					? av === bv
						? 0
						: av < bv
							? -1
							: 1
					: String(av).localeCompare(String(bv));
			return sort.direction === "asc" ? cmp : -cmp;
		});
		return out.slice(0, limit);
	}, [
		collection,
		collectionVersion,
		conditions,
		getColumnValue,
		getSortValue,
		limit,
		sort,
	]);
}
