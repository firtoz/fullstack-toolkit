/**
 * Row `id` values accepted by partial-sync (plain keys and ORM outputs such as drizzle-sqlite-wasm
 * insert-schema types that are string-like but not assignable to `string | number` in TypeScript).
 */
export type PartialSyncRowId = string | number | { toString(): string };

export function partialSyncRowKey(id: PartialSyncRowId): string | number {
	if (typeof id === "string" || typeof id === "number") return id;
	return String(id);
}
