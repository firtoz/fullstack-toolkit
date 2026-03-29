import { describe, expect, it } from "bun:test";
import type { SyncMessage } from "@firtoz/db-helpers";
import { mergeCoalescedRangePatches } from "./connect-partial-sync";
import { DEFAULT_SYNC_COLLECTION_ID } from "./sync-protocol";

type Row = { id: string; name: string; updatedAt: number };

describe("mergeCoalescedRangePatches", () => {
	it("keeps the last update per row id", () => {
		const patches = [
			{
				type: "rangePatch" as const,
				collectionId: DEFAULT_SYNC_COLLECTION_ID,
				change: {
					type: "update" as const,
					value: { id: "a", name: "one", updatedAt: 1 },
					previousValue: { id: "a", name: "zero", updatedAt: 0 },
				} satisfies SyncMessage<Row>,
			},
			{
				type: "rangePatch" as const,
				collectionId: DEFAULT_SYNC_COLLECTION_ID,
				change: {
					type: "update" as const,
					value: { id: "a", name: "two", updatedAt: 2 },
					previousValue: { id: "a", name: "one", updatedAt: 1 },
				} satisfies SyncMessage<Row>,
			},
		];
		const merged = mergeCoalescedRangePatches(patches);
		expect(merged).toHaveLength(1);
		expect(
			(merged[0]?.change as SyncMessage<Row> & { type: "update" }).value.name,
		).toBe("two");
	});

	it("preserves distinct rows", () => {
		const patches = [
			{
				type: "rangePatch" as const,
				collectionId: DEFAULT_SYNC_COLLECTION_ID,
				change: {
					type: "update" as const,
					value: { id: "a", name: "x", updatedAt: 1 },
					previousValue: { id: "a", name: "a0", updatedAt: 0 },
				} satisfies SyncMessage<Row>,
			},
			{
				type: "rangePatch" as const,
				collectionId: DEFAULT_SYNC_COLLECTION_ID,
				change: {
					type: "update" as const,
					value: { id: "b", name: "y", updatedAt: 1 },
					previousValue: { id: "b", name: "b0", updatedAt: 0 },
				} satisfies SyncMessage<Row>,
			},
		];
		expect(mergeCoalescedRangePatches(patches)).toHaveLength(2);
	});
});
