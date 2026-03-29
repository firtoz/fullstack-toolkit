import { describe, expect, it } from "bun:test";
import type { SyncMessage } from "@firtoz/db-helpers";
import { createMemoryCollection } from "@firtoz/db-helpers";
import { z } from "zod";
import { DEFAULT_SYNC_COLLECTION_ID, type SyncServerMessage } from "./sync-protocol";
import { SyncClientBridge } from "./sync-client-bridge";

const rowSchema = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number(),
	updatedAt: z.number(),
});

type Row = z.infer<typeof rowSchema>;

async function waitReady(coll: { isReady: () => boolean; preload: () => Promise<unknown> }) {
	if (coll.isReady()) return;
	await coll.preload();
}

/**
 * Simulates a writer moving a tile on an interval and a second client receiving `syncBatch` echoes
 * through {@link SyncClientBridge}, with inbound serialization matching {@link connectPartialSync}.
 */
describe("partial sync — rapid position updates (drag echo)", () => {
	it("observer reaches final x/y soon after last syncBatch (serialized dispatch + paced steps)", async () => {
		const collWriter = createMemoryCollection({
			id: "rapid-pos-writer",
			schema: rowSchema,
			getKey: (r) => r.id,
		});
		const collObserver = createMemoryCollection({
			id: "rapid-pos-observer",
			schema: rowSchema,
			getKey: (r) => r.id,
		});
		await waitReady(collWriter);
		await waitReady(collObserver);

		const seed: Row = { id: "t", x: 0, y: 0, updatedAt: 0 };
		await collWriter.insert(seed).isPersisted.promise;
		await collObserver.insert({ ...seed }).isPersisted.promise;

		const bridgeObserver = new SyncClientBridge<Row>({
			clientId: "observer",
			send: () => {},
			sendSyncHelloOnConnect: false,
			collection: collObserver,
		});
		bridgeObserver.setConnected(true);

		let inboundChain: Promise<void> = Promise.resolve();
		const enqueueToObserver = (msg: SyncServerMessage<Row>) => {
			inboundChain = inboundChain
				.catch(() => {})
				.then(() => bridgeObserver.handleServerMessage(msg));
		};

		const steps = 35;
		const paceMs = 4;
		let lastStepDoneAt = 0;

		let prevWriter = collWriter.get("t");
		expect(prevWriter).toBeDefined();
		if (prevWriter === undefined) {
			throw new Error("expected writer row");
		}
		for (let i = 1; i <= steps; i += 1) {
			await collWriter.update("t", (d) => {
				d.x = i;
				d.y = i;
				d.updatedAt = i;
			}).isPersisted.promise;
			const cur = collWriter.get("t");
			expect(cur).toBeDefined();
			if (cur === undefined) {
				throw new Error("expected writer row after update");
			}
			const change: SyncMessage<Row> = {
				type: "update",
				value: cur,
				previousValue: prevWriter,
			};
			enqueueToObserver({
				type: "syncBatch",
				collectionId: DEFAULT_SYNC_COLLECTION_ID,
				serverVersion: i,
				changes: [change],
			});
			prevWriter = cur;

			if (paceMs > 0) {
				await new Promise<void>((resolve) => {
					setTimeout(resolve, paceMs);
				});
			}
			lastStepDoneAt = performance.now();
		}

		await inboundChain;

		const doneAt = performance.now();
		const observed = collObserver.get("t");
		expect(observed?.x).toBe(steps);
		expect(observed?.y).toBe(steps);
		expect(observed?.updatedAt).toBe(steps);

		// Drain should complete quickly after the last paced step (no multi-second backlog).
		expect(doneAt - lastStepDoneAt).toBeLessThan(3000);
	});

	it("observer tolerates many concurrent syncBatch handleServerMessage calls", async () => {
		const collObserver = createMemoryCollection({
			id: "conc-observer",
			schema: rowSchema,
			getKey: (r) => r.id,
		});
		await waitReady(collObserver);
		await collObserver.insert({ id: "t", x: 0, y: 0, updatedAt: 0 }).isPersisted.promise;

		const bridgeObserver = new SyncClientBridge<Row>({
			clientId: "observer",
			send: () => {},
			sendSyncHelloOnConnect: false,
			collection: collObserver,
		});
		bridgeObserver.setConnected(true);

		const initial = collObserver.get("t");
		expect(initial).toBeDefined();
		if (initial === undefined) {
			throw new Error("expected observer row");
		}
		let prev: Row = initial;
		const tasks: Promise<void>[] = [];
		for (let i = 1; i <= 45; i += 1) {
			const next: Row = { id: "t", x: i, y: i, updatedAt: i };
			tasks.push(
				bridgeObserver.handleServerMessage({
					type: "syncBatch",
					collectionId: DEFAULT_SYNC_COLLECTION_ID,
					serverVersion: i,
					changes: [
						{
							type: "update",
							value: next,
							previousValue: prev,
						},
					],
				}),
			);
			prev = next;
		}

		await expect(Promise.all(tasks)).resolves.toBeDefined();
		expect(collObserver.get("t")?.x).toBe(45);
	});
});
