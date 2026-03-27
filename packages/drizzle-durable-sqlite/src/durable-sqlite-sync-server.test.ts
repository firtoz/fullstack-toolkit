import { describe, expect, it } from "bun:test";
import { applyDurableMutationIntents } from "./durable-sqlite-sync-server";

type Item = { id: string; title: string };

describe("applyDurableMutationIntents", () => {
	it("applies insert/update/delete/truncate and returns sync messages", async () => {
		const calls: string[] = [];
		const collection = {
			insert: () => {
				calls.push("insert");
				return { isPersisted: { promise: Promise.resolve() } };
			},
			update: () => {
				calls.push("update");
				return { isPersisted: { promise: Promise.resolve() } };
			},
			delete: () => {
				calls.push("delete");
				return { isPersisted: { promise: Promise.resolve() } };
			},
			utils: {
				truncate: async () => {
					calls.push("truncate");
				},
			},
		};

		const result = await applyDurableMutationIntents<Item>(collection, [
			{
				clientMutationId: "i1",
				type: "insert",
				value: { id: "1", title: "a" },
			},
			{
				clientMutationId: "u1",
				type: "update",
				key: "1",
				value: { id: "1", title: "b" },
				previousValue: { id: "1", title: "a" },
			},
			{ clientMutationId: "d1", type: "delete", key: "1" },
			{ clientMutationId: "t1", type: "truncate" },
		]);

		expect(calls).toEqual(["insert", "update", "delete", "truncate"]);
		expect(result.acceptedMutationIds.length).toBe(4);
		expect(result.changes.length).toBe(4);
	});
});
