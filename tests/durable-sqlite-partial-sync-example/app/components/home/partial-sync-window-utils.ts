import type { RangeCondition, RangeFingerprint } from "@firtoz/collection-sync";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { PeoplePartialSyncCollection, PersonRow } from "./types";

/** Narrow unknown collection rows to {@link PersonRow} when required fields are present. */
export function parsePersonRow(value: unknown): PersonRow | undefined {
	if (value === null || typeof value !== "object") return undefined;
	const o = value as Record<string, unknown>;
	if (
		typeof o.id !== "string" ||
		typeof o.name !== "string" ||
		typeof o.age !== "number"
	) {
		return undefined;
	}
	if (!("updatedAt" in o)) return undefined;
	return value as PersonRow;
}

function updatedAtMs(row: PersonRow): number {
	const v = row.updatedAt;
	if (v instanceof Date) return v.getTime();
	if (typeof v === "number") return v;
	return 0;
}

/**
 * Returns consecutive row ids for [offset, offset + want) if all present in the map; else null.
 */
export function tryIdsForIndexWindow(
	map: Map<number, PersonRow["id"]>,
	offset: number,
	want: number,
	totalCount: number,
): PersonRow["id"][] | null {
	if (totalCount === 0) return null;
	const n = Math.min(want, Math.max(0, totalCount - offset));
	if (n === 0) return [];
	const out: PersonRow["id"][] = [];
	for (let i = 0; i < n; i += 1) {
		const id = map.get(offset + i);
		if (id === undefined) return null;
		out.push(id);
	}
	return out;
}

/**
 * Fingerprint for reconciliation when every index in [offset, offset + want) is mapped and rows exist in the collection.
 */
export function computeFingerprintForIndexWindow(
	collection: PeoplePartialSyncCollection,
	map: Map<number, PersonRow["id"]>,
	offset: number,
	want: number,
): RangeFingerprint | undefined {
	if (want <= 0) return undefined;
	let maxV = 0;
	let count = 0;
	for (let i = 0; i < want; i += 1) {
		const id = map.get(offset + i);
		if (id === undefined) return undefined;
		const row = parsePersonRow(collection.get(id));
		if (row === undefined) return undefined;
		count += 1;
		const ms = updatedAtMs(row);
		if (ms > maxV) maxV = ms;
	}
	return { version: maxV, count };
}

function rowColumnValue(row: PersonRow, column: string): unknown {
	if (column === "age") return row.age;
	if (column === "name") return row.name;
	return (row as Record<string, unknown>)[column];
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

export function matchesPredicate(row: PersonRow, conditions: RangeCondition[]): boolean {
	return conditions.every((c) => {
		const v = rowColumnValue(row, c.column);
		switch (c.op) {
			case "eq":
				return compareUnknown(v, c.value) === 0;
			case "neq":
				return compareUnknown(v, c.value) !== 0;
			case "gt":
				return compareUnknown(v, c.value) > 0;
			case "gte":
				return compareUnknown(v, c.value) >= 0;
			case "lt":
				return compareUnknown(v, c.value) < 0;
			case "lte":
				return compareUnknown(v, c.value) <= 0;
			case "between": {
				if (c.valueTo === undefined) return false;
				return (
					compareUnknown(v, c.value) >= 0 && compareUnknown(v, c.valueTo) <= 0
				);
			}
			default:
				exhaustiveGuard(c.op);
		}
	});
}
