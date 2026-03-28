import { describe, expect, it } from "bun:test";
import type { SyncMessage } from "@firtoz/db-helpers";
import { dispatchPartialSyncServerMessage } from "./connect-partial-sync";
import { PartialSyncClientBridge } from "./partial-sync-client-bridge";
import { SyncClientBridge } from "./sync-client-bridge";

type Row = { id: string; name: string; updatedAt: number };

describe("dispatchPartialSyncServerMessage", () => {
	it("routes syncBatch through mutation bridge once and updates partial tracked ids", async () => {
		const partialReceiveSync: SyncMessage<Row>[][] = [];
		const mutationReceiveSync: SyncMessage<Row>[][] = [];

		const partialBridge = new PartialSyncClientBridge<Row>({
			clientId: "shared",
			send: () => {},
			collection: {
				utils: {
					receiveSync: async (messages) => {
						partialReceiveSync.push(messages);
					},
				},
			},
		});

		const mutationBridge = new SyncClientBridge<Row>({
			clientId: "shared",
			sendSyncHelloOnConnect: false,
			send: () => {},
			collection: {
				utils: {
					receiveSync: async (messages) => {
						mutationReceiveSync.push(messages);
					},
				},
			},
		});

		const changes: SyncMessage<Row>[] = [
			{
				type: "update",
				value: { id: "a", name: "n", updatedAt: 2 },
				previousValue: { id: "a", name: "o", updatedAt: 1 },
			},
		];

		await dispatchPartialSyncServerMessage(
			{ type: "syncBatch", serverVersion: 1, changes },
			partialBridge,
			mutationBridge,
		);

		expect(mutationReceiveSync.length).toBe(1);
		expect(partialReceiveSync.length).toBe(0);
		expect(partialBridge.cachedCount).toBe(1);
	});

	it("routes rangePatch only to partial bridge", async () => {
		const partialReceiveSync: SyncMessage<Row>[][] = [];
		const mutationReceiveSync: SyncMessage<Row>[][] = [];

		const partialBridge = new PartialSyncClientBridge<Row>({
			clientId: "shared",
			send: () => {},
			collection: {
				utils: {
					receiveSync: async (messages) => {
						partialReceiveSync.push(messages);
					},
				},
			},
		});

		const mutationBridge = new SyncClientBridge<Row>({
			clientId: "shared",
			sendSyncHelloOnConnect: false,
			send: () => {},
			collection: {
				utils: {
					receiveSync: async (messages) => {
						mutationReceiveSync.push(messages);
					},
				},
			},
		});

		const change: SyncMessage<Row> = {
			type: "update",
			value: { id: "b", name: "x", updatedAt: 3 },
			previousValue: { id: "b", name: "y", updatedAt: 2 },
		};

		await dispatchPartialSyncServerMessage(
			{ type: "rangePatch", change },
			partialBridge,
			mutationBridge,
		);

		expect(partialReceiveSync.length).toBe(1);
		expect(mutationReceiveSync.length).toBe(0);
	});
});
