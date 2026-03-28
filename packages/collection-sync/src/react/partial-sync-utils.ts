import type { CollectionUtils } from "@firtoz/db-helpers";
import type { UtilsRecord } from "@tanstack/db";
import type { RangeFingerprint } from "../sync-protocol";
import type { PartialSyncCollection, PartialSyncItem } from "./types";

/**
 * TanStack `Collection` types `utils` as {@link UtilsRecord}. This narrows to sync helpers when
 * present (e.g. after `memoryCollectionOptions` / Drizzle sync config).
 */
export function assertSyncUtils<TItem>(
	utils: UtilsRecord,
): CollectionUtils<TItem> {
	const receiveSync = utils.receiveSync;
	const truncate = utils.truncate;
	if (typeof receiveSync === "function" && typeof truncate === "function") {
		return {
			receiveSync: receiveSync as CollectionUtils<TItem>["receiveSync"],
			truncate: truncate as CollectionUtils<TItem>["truncate"],
		};
	}
	throw new Error(
		"Partial sync requires collection.utils.receiveSync and collection.utils.truncate",
	);
}

/** Default fingerprint version: max `updatedAt` as epoch ms. */
export function defaultPartialSyncVersionMs<TItem extends PartialSyncItem>(
	row: TItem,
): number {
	const v = row.updatedAt;
	if (v instanceof Date) return v.getTime();
	if (typeof v === "number") return v;
	return 0;
}

/**
 * Resolve a row for an id stored in the partial-sync index map. Uses {@link PartialSyncCollection.get}
 * first; if that misses (e.g. key type / boxed string mismatch vs TanStack’s internal map), scans
 * {@link PartialSyncCollection.entries} by `String(key)`.
 */
export function getPartialSyncRowByMapId<TItem extends PartialSyncItem>(
	collection: PartialSyncCollection<TItem>,
	id: string | number,
): TItem | undefined {
	const direct = collection.get(id);
	if (direct !== undefined) return direct;
	const sid = String(id);
	for (const [k, row] of collection.entries()) {
		if (String(k) === sid) return row;
	}
	return undefined;
}

/**
 * Returns consecutive row ids for `[offset, offset + want)` if all present in the map; else null.
 */
export function tryIdsForIndexWindow<TKey extends string | number>(
	map: Map<number, TKey>,
	offset: number,
	want: number,
	totalCount: number,
): TKey[] | null {
	if (totalCount === 0) return null;
	const n = Math.min(want, Math.max(0, totalCount - offset));
	if (n === 0) return [];
	const out: TKey[] = [];
	for (let i = 0; i < n; i += 1) {
		const id = map.get(offset + i);
		if (id === undefined) return null;
		out.push(id);
	}
	return out;
}

/**
 * Fingerprint for reconciliation when every index in `[offset, offset + want)` is mapped and rows
 * exist in the collection.
 */
export function computeFingerprintForIndexWindow<TItem extends PartialSyncItem>(
	collection: PartialSyncCollection<TItem>,
	map: Map<number, string | number>,
	offset: number,
	want: number,
	getVersionMs: (row: TItem) => number = defaultPartialSyncVersionMs,
): RangeFingerprint | undefined {
	if (want <= 0) return undefined;
	let maxV = 0;
	let count = 0;
	for (let i = 0; i < want; i += 1) {
		const id = map.get(offset + i);
		if (id === undefined) return undefined;
		const row = getPartialSyncRowByMapId(collection, id);
		if (row === undefined) return undefined;
		count += 1;
		const ms = getVersionMs(row);
		if (ms > maxV) maxV = ms;
	}
	return { version: maxV, count };
}

export { defaultPredicateColumnValue, matchesPredicate } from "../partial-sync-predicate-match";
