import type { SyncMessage } from "./sync-types";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
	type Collection,
	type CollectionConfig,
	createCollection,
	type DeleteMutationFnParams,
	type InferSchemaInput,
	type InferSchemaOutput,
	type InsertMutationFnParams,
	type SyncConfig,
	type UpdateMutationFnParams,
} from "@tanstack/db";

type MemoryCollectionConfig<TSchema extends StandardSchemaV1> = Omit<
	CollectionConfig<InferSchemaOutput<TSchema>, string | number, TSchema>,
	"onInsert" | "onUpdate" | "onDelete" | "sync" | "schema"
> & {
	schema: TSchema;
	/** Called when a local mutation is written to the sync layer; use to broadcast to other peers. */
	onBroadcast?: (
		changes: SyncMessage<InferSchemaOutput<TSchema>, string | number>[],
	) => void;
};

type MemoryUtils<
	TItem = unknown,
	TKey extends string | number = string | number,
> = {
	truncate: () => Promise<void>;
	/**
	 * Apply incoming sync messages without triggering onInsert/onUpdate/onDelete.
	 * Uses the sync layer (begin/write/commit) so state updates and subscribeChanges fire,
	 * but no rebroadcast occurs.
	 */
	receiveSync: (messages: SyncMessage<TItem, TKey>[]) => Promise<void>;
};

export function memoryCollectionOptions<TSchema extends StandardSchemaV1>(
	config: MemoryCollectionConfig<TSchema>,
): CollectionConfig<InferSchemaOutput<TSchema>, string | number, TSchema> & {
	utils: MemoryUtils<InferSchemaOutput<TSchema>, string | number>;
	schema: TSchema;
} {
	type TItem = InferSchemaOutput<TSchema>;
	type TKey = string | number;
	let syncParams: Parameters<SyncConfig<TItem>["sync"]>[0] | null = null;
	/** Batches from `receiveSync` that arrived before TanStack called `sync`. */
	const pendingReceiveSyncBatches: SyncMessage<TItem, TKey>[][] = [];

	const sync: SyncConfig<TItem>["sync"] = (params) => {
		syncParams = params;
		params.markReady();
		for (const batch of pendingReceiveSyncBatches) {
			writeChanges(batch);
		}
		pendingReceiveSyncBatches.length = 0;
		return () => {};
	};

	const writeChanges = (writes: SyncMessage<TItem, TKey>[]) => {
		if (!syncParams) {
			throw new Error("Sync parameters not initialized");
		}
		syncParams.begin();
		for (const msg of writes) {
			switch (msg.type) {
				case "insert":
					syncParams.write({ type: "insert", value: msg.value });
					break;
				case "update":
					syncParams.write({
						type: "update",
						value: msg.value,
						previousValue: msg.previousValue,
					});
					break;
				case "delete":
					syncParams.write({ type: "delete", key: msg.key });
					break;
				case "truncate":
					syncParams.truncate();
					break;
				default:
					exhaustiveGuard(msg);
			}
		}
		syncParams.commit();
	};

	const onInsert = async (params: InsertMutationFnParams<TItem>) => {
		const writes: SyncMessage<TItem, TKey>[] = [];
		for (const mutation of params.transaction.mutations) {
			writes.push({ type: "insert", value: mutation.modified });
		}
		writeChanges(writes);
		config.onBroadcast?.(writes);
	};

	const onUpdate = async (params: UpdateMutationFnParams<TItem>) => {
		const writes: SyncMessage<TItem, TKey>[] = [];
		for (const mutation of params.transaction.mutations) {
			writes.push({
				type: "update",
				value: mutation.modified,
				previousValue: mutation.original,
			});
		}
		writeChanges(writes);
		config.onBroadcast?.(writes);
	};

	const onDelete = async (params: DeleteMutationFnParams<TItem>) => {
		const writes: SyncMessage<TItem, TKey>[] = [];
		for (const mutation of params.transaction.mutations) {
			writes.push({ type: "delete", key: mutation.key as TKey });
		}
		writeChanges(writes);
		config.onBroadcast?.(writes);
	};

	const truncate = async () => {
		if (!syncParams) {
			// TanStack may not have invoked `sync` yet (e.g. first paint / effect). Nothing to clear.
			pendingReceiveSyncBatches.length = 0;
			return;
		}
		syncParams.begin();
		syncParams.truncate();
		syncParams.commit();
	};

	const receiveSync = async (messages: SyncMessage<TItem, TKey>[]) => {
		if (messages.length === 0) return;
		if (!syncParams) {
			pendingReceiveSyncBatches.push(messages);
			return;
		}
		writeChanges(messages);
	};

	return {
		id: config.id,
		schema: config.schema,
		getKey: config.getKey,
		sync: { sync },
		onInsert,
		onUpdate,
		onDelete,
		utils: {
			truncate,
			receiveSync,
		},
	};
}

export type MemoryCollection<TSchema extends StandardSchemaV1> = Collection<
	InferSchemaOutput<TSchema>,
	string | number,
	MemoryUtils<InferSchemaOutput<TSchema>, string | number>,
	TSchema,
	InferSchemaInput<TSchema>
>;

export function createMemoryCollection<TSchema extends StandardSchemaV1>(
	config: MemoryCollectionConfig<TSchema>,
): MemoryCollection<TSchema> {
	return createCollection(
		memoryCollectionOptions(config),
	) as MemoryCollection<TSchema>;
}
