import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import {
	partialSyncRowKey,
	partialSyncRowVersionWatermarkMs,
	partialSyncRowVersionWatermarkMsUnknown,
	type PartialSyncRowId,
	type PartialSyncRowShape,
} from "./partial-sync-row-key";
import {
	createClientMutationId,
	DEFAULT_SYNC_COLLECTION_ID,
	type MutationIntent,
	type SyncClientMessage,
	type SyncClientMessageBody,
	type SyncServerMessage,
} from "./sync-protocol";

type CollectionWithReceiveSync<TItem> = {
	utils: {
		receiveSync: (messages: SyncMessage<TItem>[]) => Promise<void>;
	};
};

type SendFn = (msg: SyncClientMessage) => void;

type PendingMutation = {
	clientMutationId: string;
	key: string | number;
	intent: MutationIntent;
	updatedAt: number;
};

export interface SyncClientBridgeOptions<TItem extends PartialSyncRowShape> {
	clientId: string;
	/** Must match the server's {@link SyncServerBridgeOptions.collectionId}. */
	collectionId?: string;
	collection: CollectionWithReceiveSync<TItem>;
	send: SendFn;
	initialLastAckedServerVersion?: number;
	onLastAckedServerVersionChange?: (version: number) => void;
	onRejectedMutation?: (reason: string, mutationId: string) => void;
	/**
	 * When `false`, `setConnected(true)` does not send `syncHello` (partial-sync + `mutateBatch` only).
	 * Default `true` for full sync.
	 */
	sendSyncHelloOnConnect?: boolean;
}

export class SyncClientBridge<TItem extends PartialSyncRowShape> {
	readonly clientId: string;
	readonly collectionId: string;
	#pendingMutations = new Map<string, PendingMutation>();
	#pendingMutationByKey = new Map<string | number, string>();
	/** Truncate has no row key; track at most one pending truncate mutation. */
	#pendingTruncateMutationId: string | null = null;
	#lastAckedServerVersion = 0;
	#connected = false;
	#activeBackfill:
		| {
				mode: "snapshot" | "delta";
				serverVersion: number;
				totalChunks: number;
				receivedChunks: number;
				snapshotTruncateApplied: boolean;
		  }
		| undefined;
	readonly #sendSyncHelloOnConnect: boolean;
	/**
	 * When set (via {@link SyncClientBridge.setRowGet} after `createCollection`), server `insert`
	 * messages are turned into `update` if that row is already in the collection — required when
	 * partial `rangePatch` hydrated the row before an `ack`/`syncBatch` insert arrives.
	 */
	#rowGet: ((key: string | number) => TItem | undefined) | undefined;

	constructor(private readonly options: SyncClientBridgeOptions<TItem>) {
		this.clientId = options.clientId;
		this.collectionId = options.collectionId ?? DEFAULT_SYNC_COLLECTION_ID;
		this.#sendSyncHelloOnConnect = options.sendSyncHelloOnConnect ?? true;
		this.#lastAckedServerVersion = Math.max(
			0,
			options.initialLastAckedServerVersion ?? 0,
		);
	}

	get pendingCount(): number {
		return this.#pendingMutations.size;
	}

	setConnected(connected: boolean): void {
		this.#connected = connected;
		if (connected && this.#sendSyncHelloOnConnect) {
			this.sendHello();
		}
	}

	/**
	 * Wire `collection.get` after the TanStack collection exists so mutation-path `receiveSync` can
	 * coerce duplicate `insert` echoes to `update` (partial sync + `mutateBatch`).
	 */
	setRowGet(
		get: ((key: string | number) => TItem | undefined) | undefined,
	): void {
		this.#rowGet = get;
	}

	sendHello(): void {
		this.#out({
			type: "syncHello",
			clientId: this.clientId,
			lastAckedServerVersion: this.#lastAckedServerVersion,
		});
	}

	#out(msg: SyncClientMessageBody): void {
		this.options.send({
			...msg,
			collectionId: this.collectionId,
		} as SyncClientMessage);
	}

	onLocalMutation(changes: SyncMessage<TItem>[]): void {
		const intents = this.#toIntents(changes);
		for (const intent of intents) {
			this.#rememberPendingIntent(intent);
		}
		if (this.#connected) {
			this.#sendPendingIntents();
		}
	}

	sendInsert(value: TItem): string {
		const mutationId = createClientMutationId("insert");
		const intent: MutationIntent = {
			clientMutationId: mutationId,
			type: "insert",
			value: value as Record<string, unknown>,
		};
		this.#rememberPendingIntent(intent);
		if (this.#connected) this.#sendPendingIntents();
		return mutationId;
	}

	sendUpdate(updated: TItem, previousValue: TItem): string {
		const mutationId = createClientMutationId("update");
		const intent: MutationIntent = {
			clientMutationId: mutationId,
			type: "update",
			key: partialSyncRowKey(updated.id),
			value: updated as Record<string, unknown>,
			previousValue: previousValue as Record<string, unknown>,
		};
		this.#rememberPendingIntent(intent);
		if (this.#connected) this.#sendPendingIntents();
		return mutationId;
	}

	sendDelete(key: string | number): string {
		const mutationId = createClientMutationId("delete");
		const intent: MutationIntent = {
			clientMutationId: mutationId,
			type: "delete",
			key,
		};
		this.#rememberPendingIntent(intent);
		if (this.#connected) this.#sendPendingIntents();
		return mutationId;
	}

	async handleServerMessage(message: SyncServerMessage<TItem>): Promise<void> {
		const mid = message.collectionId ?? DEFAULT_SYNC_COLLECTION_ID;
		if (mid !== this.collectionId) return;
		switch (message.type) {
			case "ack":
				this.#updateLastAckedServerVersion(message.serverVersion);
				await this.options.collection.utils.receiveSync(
					this.#coerceInsertsWhenRowExists(
						this.#filterIncomingChanges(
							message.changes as SyncMessage<TItem>[],
						),
					),
				);
				for (const mutationId of message.clientMutationIds) {
					this.#forgetPendingMutation(mutationId);
				}
				return;
			case "syncBatch":
				this.#updateLastAckedServerVersion(message.serverVersion);
				await this.options.collection.utils.receiveSync(
					this.#coerceInsertsWhenRowExists(
						this.#filterIncomingChanges(
							message.changes as SyncMessage<TItem>[],
						),
					),
				);
				return;
			case "syncBackfill": {
				this.#updateLastAckedServerVersion(message.serverVersion);
				const incomingChanges = this.#filterIncomingChanges(
					message.changes as SyncMessage<TItem>[],
				);
				const totalChunks = message.totalChunks ?? 1;
				const chunkIndex = message.chunkIndex ?? 0;
				const isChunked = totalChunks > 1 || message.chunkIndex !== undefined;
				if (
					!this.#activeBackfill ||
					chunkIndex === 0 ||
					this.#activeBackfill.serverVersion !== message.serverVersion ||
					this.#activeBackfill.mode !== message.mode
				) {
					this.#activeBackfill = {
						mode: message.mode,
						serverVersion: message.serverVersion,
						totalChunks,
						receivedChunks: 0,
						snapshotTruncateApplied: false,
					};
				}

				const active = this.#activeBackfill;
				const outgoingChanges: SyncMessage<TItem>[] = [];
				if (active.mode === "snapshot" && !active.snapshotTruncateApplied) {
					outgoingChanges.push({ type: "truncate" });
					active.snapshotTruncateApplied = true;
				}
				outgoingChanges.push(...incomingChanges);

				if (outgoingChanges.length > 0) {
					await this.options.collection.utils.receiveSync(
						this.#coerceInsertsWhenRowExists(outgoingChanges),
					);
				}

				active.receivedChunks += 1;
				const isFinalChunk = isChunked
					? chunkIndex >= totalChunks - 1
					: active.receivedChunks >= 1;
				if (isFinalChunk) {
					this.#activeBackfill = undefined;
					this.#sendPendingIntents();
				}
				return;
			}
			case "reject": {
				this.#forgetPendingMutation(message.clientMutationId);
				const allChanges = message.correctiveChanges as SyncMessage<TItem>[];
				if (allChanges.length > 0) {
					await this.options.collection.utils.receiveSync(
						this.#coerceInsertsWhenRowExists(allChanges),
					);
				}

				this.options.onRejectedMutation?.(
					message.reason,
					message.clientMutationId,
				);
				return;
			}
			case "pong":
				return;
			case "queryRangeChunk":
			case "rangePatch":
			case "rangeUpToDate":
			case "rangeDelta":
				// Not supported by the full-sync bridge; partial sync uses PartialSyncClientBridge.
				return;
			default:
				exhaustiveGuard(message);
		}
	}

	#toIntents(changes: SyncMessage<TItem>[]): MutationIntent[] {
		const intents: MutationIntent[] = [];
		for (const change of changes) {
			const clientMutationId = createClientMutationId(change.type);
			switch (change.type) {
				case "insert":
					intents.push({
						clientMutationId,
						type: "insert",
						value: change.value as Record<string, unknown>,
					});
					break;
				case "update":
					intents.push({
						clientMutationId,
						type: "update",
						key: partialSyncRowKey(change.value.id),
						value: change.value as Record<string, unknown>,
						previousValue: change.previousValue as Record<string, unknown>,
					});
					break;
				case "delete":
					intents.push({
						clientMutationId,
						type: "delete",
						key: change.key,
					});
					break;
				case "truncate":
					intents.push({
						clientMutationId,
						type: "truncate",
					});
					break;
				default:
					exhaustiveGuard(change);
			}
		}
		return intents;
	}

	#rememberPendingIntent(intent: MutationIntent): void {
		const key = this.#intentKey(intent);
		if (intent.type === "truncate") {
			if (this.#pendingTruncateMutationId) {
				this.#pendingMutations.delete(this.#pendingTruncateMutationId);
			}
			this.#pendingTruncateMutationId = intent.clientMutationId;
			const pending: PendingMutation = {
				clientMutationId: intent.clientMutationId,
				key: "__truncate__",
				intent,
				updatedAt: 0,
			};
			this.#pendingMutations.set(intent.clientMutationId, pending);
			return;
		}
		if (key === null) return;
		const pending: PendingMutation = {
			clientMutationId: intent.clientMutationId,
			key,
			intent,
			updatedAt: this.#intentUpdatedAt(intent),
		};
		this.#pendingMutationByKey.set(key, intent.clientMutationId);
		this.#pendingMutations.set(intent.clientMutationId, pending);
	}

	#forgetPendingMutation(mutationId: string): void {
		const pending = this.#pendingMutations.get(mutationId);
		if (!pending) return;
		this.#pendingMutations.delete(mutationId);
		if (pending.intent.type === "truncate") {
			if (this.#pendingTruncateMutationId === mutationId) {
				this.#pendingTruncateMutationId = null;
			}
			return;
		}
		if (this.#pendingMutationByKey.get(pending.key) === mutationId) {
			this.#pendingMutationByKey.delete(pending.key);
		}
	}

	#sendPendingIntents(): void {
		if (!this.#connected) return;
		if (this.#pendingMutations.size === 0) return;
		const intents = Array.from(this.#pendingMutations.values()).map(
			(p) => p.intent,
		);
		this.#out({
			type: "mutateBatch",
			clientId: this.clientId,
			mutations: intents,
		});
	}

	#localRowForIncomingInsert(id: PartialSyncRowId): TItem | undefined {
		const get = this.#rowGet;
		if (get === undefined) return undefined;
		if (typeof id === "string" || typeof id === "number") {
			return get(id) ?? get(partialSyncRowKey(id));
		}
		return get(partialSyncRowKey(id));
	}

	#coerceInsertsWhenRowExists(
		changes: SyncMessage<TItem>[],
	): SyncMessage<TItem>[] {
		if (this.#rowGet === undefined) return changes;
		const out: SyncMessage<TItem>[] = [];
		for (const ch of changes) {
			if (ch.type !== "insert") {
				out.push(ch);
				continue;
			}
			const local = this.#localRowForIncomingInsert(ch.value.id);
			if (local === undefined) {
				out.push(ch);
			} else {
				out.push({
					type: "update",
					value: ch.value,
					previousValue: local,
				});
			}
		}
		return out;
	}

	#filterIncomingChanges(changes: SyncMessage<TItem>[]): SyncMessage<TItem>[] {
		const out: SyncMessage<TItem>[] = [];
		for (const change of changes) {
			if (change.type !== "update") {
				out.push(change);
				continue;
			}
			const pendingMutationId = this.#pendingMutationByKey.get(
				partialSyncRowKey(change.value.id),
			);
			if (!pendingMutationId) {
				out.push(change);
				continue;
			}
			const pending = this.#pendingMutations.get(pendingMutationId);
			if (!pending) {
				out.push(change);
				continue;
			}
			if (partialSyncRowVersionWatermarkMs(change.value) >= pending.updatedAt) {
				out.push(change);
			}
		}
		return out;
	}

	#intentKey(intent: MutationIntent): string | number | null {
		switch (intent.type) {
			case "insert": {
				const raw = (intent.value as { id?: PartialSyncRowId }).id;
				return raw === undefined ? "" : partialSyncRowKey(raw);
			}
			case "update":
				return intent.key ?? null;
			case "delete":
				return intent.key ?? null;
			case "truncate":
				return null;
			default:
				exhaustiveGuard(intent.type);
		}
	}

	#intentUpdatedAt(intent: MutationIntent): number {
		if (intent.type === "insert" || intent.type === "update") {
			return partialSyncRowVersionWatermarkMsUnknown(intent.value);
		}
		return 0;
	}

	#updateLastAckedServerVersion(version: number): void {
		const nextVersion = Math.max(this.#lastAckedServerVersion, version);
		if (nextVersion === this.#lastAckedServerVersion) return;
		this.#lastAckedServerVersion = nextVersion;
		this.options.onLastAckedServerVersionChange?.(nextVersion);
	}
}
