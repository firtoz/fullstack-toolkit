import type { CollectionUtils } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { UtilsRecord } from "@tanstack/db";
import type { RangeCondition, RangeFingerprint } from "../sync-protocol";
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
