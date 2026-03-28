/**
 * Row `id` values accepted by partial-sync (plain keys and ORM outputs such as drizzle-sqlite-wasm
 * insert-schema types that are string-like but not assignable to `string | number` in TypeScript).
 */
export type PartialSyncRowId = string | number | { toString(): string };

/**
 * Minimal object shape keyed by a partial-sync row id. Use when only identity matters (e.g. cache
 * keys). Prefer {@link PartialSyncRowShape} for sync / partial-sync bridges and hooks.
 */
export type PartialSyncRowRef = {
	id: PartialSyncRowId;
};

/**
 * Version watermark for sync / partial-sync (fingerprints, reconciliation). The **`updatedAt` key
 * must exist** on the object; `null` or `undefined` mean “no ms watermark” at runtime (treated as
 * `0` where a number is needed). Rows or ORM types **without** this property are not suitable for
 * sync / partial-sync APIs—use {@link PartialSyncRowRef} only when you only need identity (e.g.
 * cache keys). (`undefined` is included in the union so Drizzle `InferSelectModel` / optional
 * columns remain assignable.)
 */
export type PartialSyncRowVersion = {
	updatedAt: number | Date | null | undefined;
};

/**
 * Row shape required across {@link PartialSyncClientBridge}, {@link SyncClientBridge}, and React
 * partial-sync hooks: stable id plus a mandatory {@link PartialSyncRowVersion} key (see there).
 */
export type PartialSyncRowShape = PartialSyncRowRef & PartialSyncRowVersion;

/** Max `updatedAt` as epoch ms; `null` / `undefined` → 0. */
export function partialSyncRowVersionWatermarkMs(
	row: PartialSyncRowVersion,
): number {
	const v = row.updatedAt;
	if (v === null || v === undefined) return 0;
	if (typeof v === "number") return v;
	if (v instanceof Date) return v.getTime();
	return 0;
}

/**
 * Like {@link partialSyncRowVersionWatermarkMs} for decoded protocol payloads that are not yet
 * narrowed to {@link PartialSyncRowVersion} (e.g. mutate-batch `value` fields). Missing
 * `updatedAt` → 0.
 */
export function partialSyncRowVersionWatermarkMsUnknown(row: unknown): number {
	if (!row || typeof row !== "object" || !("updatedAt" in row)) return 0;
	return partialSyncRowVersionWatermarkMs(row as PartialSyncRowVersion);
}

export function partialSyncRowKey(id: PartialSyncRowId): string | number {
	if (typeof id === "string" || typeof id === "number") return id;
	return String(id);
}
