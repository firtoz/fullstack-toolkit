import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { PartialSyncServerBridge } from "./partial-sync-server-bridge";
import {
	partialSyncRowKey,
	type PartialSyncRowShape,
} from "./partial-sync-row-key";
import type {
	MutationIntent,
	SyncClientMessage,
	SyncServerMessage,
	SyncServerMessageBody,
} from "./sync-protocol";
import { DEFAULT_SYNC_COLLECTION_ID, toSyncMessage } from "./sync-protocol";

export interface PartialSyncMutationHandlerStore<
	TItem extends PartialSyncRowShape,
> {
	applySyncMessages: (messages: SyncMessage<TItem>[]) => Promise<void>;
	getRow: (key: string | number) => Promise<TItem | undefined>;
}

export interface PartialSyncMutationHandlerOptions<
	TItem extends PartialSyncRowShape,
> {
	store: PartialSyncMutationHandlerStore<TItem>;
	partialBridge: PartialSyncServerBridge<TItem>;
	sendToClient: (clientId: string, message: SyncServerMessage<TItem>) => void;
	collectionId?: string;
}

function toMillis(value: number | Date | null | undefined): number {
	if (typeof value === "number") return value;
	if (value instanceof Date) return value.getTime();
	return 0;
}

/**
 * Partial-sync durable object mutation path: `mutateBatch` → `ack` / `reject` + interest-scoped
 * `rangePatch` via {@link PartialSyncServerBridge.pushServerChanges}. No `serverVersion`, changelog,
 * or `syncBatch` broadcast.
 */
export class PartialSyncMutationHandler<TItem extends PartialSyncRowShape> {
	readonly #cid: string;

	constructor(
		private readonly options: PartialSyncMutationHandlerOptions<TItem>,
	) {
		this.#cid = options.collectionId ?? DEFAULT_SYNC_COLLECTION_ID;
	}

	get collectionId(): string {
		return this.#cid;
	}

	#emit(clientId: string, body: SyncServerMessageBody<TItem>): void {
		this.options.sendToClient(clientId, {
			...body,
			collectionId: this.#cid,
		} as SyncServerMessage<TItem>);
	}

	async handleClientMessage(message: SyncClientMessage): Promise<void> {
		const mid = message.collectionId ?? DEFAULT_SYNC_COLLECTION_ID;
		if (mid !== this.#cid) return;
		switch (message.type) {
			case "ping":
				this.#emit(message.clientId, {
					type: "pong",
					timestamp: message.timestamp,
				});
				return;
			case "mutateBatch":
				await this.#handleMutateBatch(message);
				return;
			case "syncHello":
			case "queryRange":
			case "queryByOffset":
			case "rangeQuery":
			case "rangeReconcile":
				return;
			default:
				exhaustiveGuard(message);
		}
	}

	async #intentToMessageLww(
		intent: MutationIntent,
	): Promise<SyncMessage<TItem> | null> {
		const base = toSyncMessage(intent) as SyncMessage<TItem>;
		if (base.type !== "update") {
			return base;
		}
		const key = partialSyncRowKey(intent.key ?? base.value.id);
		const existing = await this.options.store.getRow(key);
		if (!existing) {
			return base;
		}
		const incomingUpdatedAt = toMillis(base.value.updatedAt);
		const existingUpdatedAt = toMillis(existing.updatedAt);
		if (incomingUpdatedAt <= existingUpdatedAt) {
			return {
				type: "update",
				value: existing,
				previousValue: base.previousValue,
			};
		}
		return base;
	}

	async #handleMutateBatch(
		message: Extract<SyncClientMessage, { type: "mutateBatch" }>,
	): Promise<void> {
		const resolvedChanges: SyncMessage<TItem>[] = [];
		const acceptedMutationIds: string[] = [];

		for (const mutation of message.mutations) {
			try {
				const change = await this.#intentToMessageLww(mutation);
				if (!change) {
					continue;
				}
				resolvedChanges.push(change);
				acceptedMutationIds.push(mutation.clientMutationId);
			} catch (error) {
				this.#emit(message.clientId, {
					type: "reject",
					clientId: message.clientId,
					clientMutationId: mutation.clientMutationId,
					reason: error instanceof Error ? error.message : String(error),
					correctiveChanges: [],
				});
			}
		}

		if (resolvedChanges.length === 0) return;

		await this.options.store.applySyncMessages(resolvedChanges);

		this.#emit(message.clientId, {
			type: "ack",
			clientId: message.clientId,
			clientMutationIds: acceptedMutationIds,
			serverVersion: 0,
			changes: resolvedChanges,
		});

		await this.options.partialBridge.pushServerChanges(resolvedChanges, {
			excludeClientId: message.clientId,
		});
	}
}
