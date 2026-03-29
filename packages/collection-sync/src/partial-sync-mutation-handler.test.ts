import { describe, expect, it } from "bun:test";
import type { SyncMessage } from "@firtoz/db-helpers";
import type { PartialSyncServerBridge } from "./partial-sync-server-bridge";
import type { PartialSyncRowShape } from "./partial-sync-row-key";
import { PartialSyncMutationHandler } from "./partial-sync-mutation-handler";
import { DEFAULT_SYNC_COLLECTION_ID } from "./sync-protocol";

type Item = PartialSyncRowShape & { name: string };

describe("PartialSyncMutationHandler", () => {
	it("applies mutations, acks with serverVersion 0, and pushes to partial bridge", async () => {
		const applied: SyncMessage<Item>[][] = [];
		const sent: unknown[] = [];
		const pushed: SyncMessage<Item>[][] = [];

		const store = {
			applySyncMessages: async (messages: SyncMessage<Item>[]) => {
				applied.push(messages);
			},
			getRow: async (_key: string | number) => undefined,
		};

		const partialBridge = {
			pushServerChanges: async (changes: SyncMessage<Item>[]) => {
				pushed.push(changes);
			},
		} as PartialSyncServerBridge<Item>;

		const handler = new PartialSyncMutationHandler<Item>({
			store,
			partialBridge,
			sendToClient: (_clientId, message) => {
				sent.push(message);
			},
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
		});

		await handler.handleClientMessage({
			type: "mutateBatch",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "u1",
			mutations: [
				{
					clientMutationId: "m1",
					type: "insert",
					value: { id: "1", name: "n", updatedAt: 1 },
				},
			],
		});

		expect(applied.length).toBe(1);
		expect(applied[0]?.[0]?.type).toBe("insert");
		expect(pushed.length).toBe(1);
		expect(pushed[0]?.[0]?.type).toBe("insert");
		expect(sent.length).toBe(1);
		const ack = sent[0] as {
			type: string;
			serverVersion: number;
			clientMutationIds: string[];
		};
		expect(ack.type).toBe("ack");
		expect(ack.serverVersion).toBe(0);
		expect(ack.clientMutationIds).toEqual(["m1"]);
	});

	it("ignores syncHello", async () => {
		const handler = new PartialSyncMutationHandler<Item>({
			store: {
				applySyncMessages: async () => {},
				getRow: async () => undefined,
			},
			partialBridge: {
				pushServerChanges: async () => {},
			} as PartialSyncServerBridge<Item>,
			sendToClient: () => {
				throw new Error("should not send");
			},
		});

		await handler.handleClientMessage({
			type: "syncHello",
			collectionId: DEFAULT_SYNC_COLLECTION_ID,
			clientId: "u1",
			lastAckedServerVersion: 0,
		});
	});
});
