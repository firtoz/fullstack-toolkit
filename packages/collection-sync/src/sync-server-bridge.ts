import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type {
	MutationIntent,
	SyncBackfillMode,
	SyncClientMessage,
	SyncServerMessage,
	SyncServerMessageBody,
} from "./sync-protocol";
import { DEFAULT_SYNC_COLLECTION_ID } from "./sync-protocol";
import { toSyncMessage } from "./sync-protocol";
import {
	partialSyncRowKey,
	type PartialSyncRowShape,
} from "./partial-sync-row-key";

export interface SyncServerBridgeStore<TItem> {
	applySyncMessages: (messages: SyncMessage<TItem>[]) => Promise<void>;
	getSnapshotMessages: () => Promise<SyncMessage<TItem>[]>;
	getRow: (key: string | number) => Promise<TItem | undefined>;
}

export interface SyncServerBridgeOptions<TItem> {
	store: SyncServerBridgeStore<TItem>;
	sendToClient: (clientId: string, message: SyncServerMessage<TItem>) => void;
	broadcastExcept: (
		excludeClientId: string,
		message: SyncServerMessage<TItem>,
	) => void;
	/** Deliver a server message to every connected client (e.g. {@link SyncServerBridge.pushServerChanges}). */
	broadcastAll?: (message: SyncServerMessage<TItem>) => void;
	/** Maximum number of changes per `syncBackfill` frame. Defaults to 500. */
	backfillChunkSize?: number;
	/** Multiplex key for sync messages. Default {@link DEFAULT_SYNC_COLLECTION_ID}. */
	collectionId?: string;
}

export class SyncServerBridge<TItem extends PartialSyncRowShape> {
	#serverVersion = 0;
	#changeLog: Array<{ serverVersion: number; changes: SyncMessage<TItem>[] }> =
		[];
	readonly #cid: string;

	constructor(private readonly options: SyncServerBridgeOptions<TItem>) {
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

	#broadcastExcept(
		excludeClientId: string,
		body: SyncServerMessageBody<TItem>,
	): void {
		this.options.broadcastExcept(excludeClientId, {
			...body,
			collectionId: this.#cid,
		} as SyncServerMessage<TItem>);
	}

	#broadcastAll(body: SyncServerMessageBody<TItem>): void {
		this.options.broadcastAll?.({
			...body,
			collectionId: this.#cid,
		} as SyncServerMessage<TItem>);
	}

	get serverVersion(): number {
		return this.#serverVersion;
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
			case "syncHello": {
				const { mode, changes } = await this.#resolveBackfill(
					message.lastAckedServerVersion,
				);
				const chunks = this.#chunkBackfillChanges(changes);
				const totalChunks = chunks.length;
				for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
					this.#emit(message.clientId, {
						type: "syncBackfill",
						mode,
						serverVersion: this.#serverVersion,
						changes: chunks[chunkIndex],
						chunkIndex,
						totalChunks,
					});
				}
				return;
			}
			case "mutateBatch":
				await this.#handleMutateBatch(message);
				return;
			case "queryRange":
			case "queryByOffset":
			case "rangeQuery":
				// Not supported by the full-sync bridge; partial sync uses PartialSyncServerBridge.
				return;
			default:
				exhaustiveGuard(message);
		}
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
		this.#serverVersion += 1;
		this.#changeLog.push({
			serverVersion: this.#serverVersion,
			changes: resolvedChanges,
		});

		this.#emit(message.clientId, {
			type: "ack",
			clientId: message.clientId,
			clientMutationIds: acceptedMutationIds,
			serverVersion: this.#serverVersion,
			changes: resolvedChanges,
		});

		this.#broadcastExcept(message.clientId, {
			type: "syncBatch",
			serverVersion: this.#serverVersion,
			changes: resolvedChanges,
		});
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
		const incomingUpdatedAt = this.#toMillis(base.value.updatedAt);
		const existingUpdatedAt = this.#toMillis(existing.updatedAt);
		if (incomingUpdatedAt <= existingUpdatedAt) {
			return {
				type: "update",
				value: existing,
				previousValue: base.previousValue,
			};
		}
		return base;
	}

	#toMillis(value: number | Date | null | undefined): number {
		if (typeof value === "number") return value;
		if (value instanceof Date) return value.getTime();
		return 0;
	}

	async #resolveBackfill(lastAckedServerVersion: number): Promise<{
		mode: SyncBackfillMode;
		changes: SyncMessage<TItem>[];
	}> {
		if (lastAckedServerVersion <= 0) {
			return {
				mode: "snapshot",
				changes: await this.options.store.getSnapshotMessages(),
			};
		}
		// Client can be "ahead" after server restart/reset; force a full snapshot.
		if (lastAckedServerVersion > this.#serverVersion) {
			return {
				mode: "snapshot",
				changes: await this.options.store.getSnapshotMessages(),
			};
		}
		const oldestLogged = this.#changeLog[0]?.serverVersion;
		if (
			oldestLogged !== undefined &&
			lastAckedServerVersion < oldestLogged - 1
		) {
			return {
				mode: "snapshot",
				changes: await this.options.store.getSnapshotMessages(),
			};
		}

		const changes: SyncMessage<TItem>[] = [];
		for (const entry of this.#changeLog) {
			if (entry.serverVersion > lastAckedServerVersion) {
				changes.push(...entry.changes);
			}
		}
		return { mode: "delta", changes };
	}

	#chunkBackfillChanges(changes: SyncMessage<TItem>[]): SyncMessage<TItem>[][] {
		const chunkSize = Math.max(1, this.options.backfillChunkSize ?? 500);
		if (changes.length === 0) return [[]];
		const chunks: SyncMessage<TItem>[][] = [];
		for (let i = 0; i < changes.length; i += chunkSize) {
			chunks.push(changes.slice(i, i + chunkSize));
		}
		return chunks;
	}

	/**
	 * Apply mutations that originated on the server (cron, admin API, etc.) and fan out to all clients.
	 */
	async pushServerChanges(changes: SyncMessage<TItem>[]): Promise<void> {
		if (changes.length === 0) return;
		await this.options.store.applySyncMessages(changes);
		this.#serverVersion += 1;
		this.#changeLog.push({
			serverVersion: this.#serverVersion,
			changes,
		});
		this.#broadcastAll({
			type: "syncBatch",
			serverVersion: this.#serverVersion,
			changes,
		});
	}
}
