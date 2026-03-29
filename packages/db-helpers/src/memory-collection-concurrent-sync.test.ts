import { describe, expect, it } from "bun:test";
import { z } from "zod";
import type { MemoryCollection } from "./memoryCollection";
import { createMemoryCollection } from "./memoryCollection";

const pointSchema = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number(),
});

async function waitReady(
	coll: Pick<MemoryCollection<typeof pointSchema>, "isReady" | "preload">,
) {
	if (coll.isReady()) return;
	await coll.preload();
}

describe("memory collection — serialized sync writes", () => {
	it("allows many concurrent receiveSync promises without throwing", async () => {
		const coll = createMemoryCollection({
			id: "concurrent-rx",
			schema: pointSchema,
			getKey: (r) => r.id,
		});
		await waitReady(coll);

		const ins = coll.insert({ id: "a", x: 0, y: 0 });
		await ins.isPersisted.promise;

		let prev: z.infer<typeof pointSchema> = { id: "a", x: 0, y: 0 };
		const tasks: Promise<void>[] = [];
		for (let i = 1; i <= 50; i += 1) {
			const next = { id: "a", x: i, y: i };
			const p = prev;
			tasks.push(
				coll.utils.receiveSync([
					{
						type: "update",
						value: next,
						previousValue: p,
					},
				]),
			);
			prev = next;
		}

		await expect(Promise.all(tasks)).resolves.toBeDefined();
		expect(coll.get("a")?.x).toBe(50);
	});

	it("interleaves rapid local update with concurrent receiveSync (drag + echo)", async () => {
		const coll = createMemoryCollection({
			id: "interleave",
			schema: pointSchema,
			getKey: (r) => r.id,
		});
		await waitReady(coll);

		await coll.insert({ id: "a", x: 0, y: 0 }).isPersisted.promise;

		const tasks: Promise<unknown>[] = [];
		for (let i = 1; i <= 30; i += 1) {
			tasks.push(
				coll.update("a", (d) => {
					d.x = i;
					d.y = i;
				}).isPersisted.promise,
			);
			const cur = coll.get("a");
			if (cur !== undefined) {
				const echo = { ...cur, x: cur.x + 100, y: cur.y + 100 };
				tasks.push(
					coll.utils.receiveSync([
						{
							type: "update",
							value: echo,
							previousValue: cur,
						},
					]),
				);
			}
		}

		await expect(Promise.all(tasks)).resolves.toBeDefined();
		const final = coll.get("a");
		expect(final).toBeDefined();
		expect(typeof final?.x).toBe("number");
	});
});
