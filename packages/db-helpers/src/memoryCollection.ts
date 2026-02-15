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
};

type MemoryUtils = {
	truncate: () => Promise<void>;
};

export function memoryCollectionOptions<TSchema extends StandardSchemaV1>(
	config: MemoryCollectionConfig<TSchema>,
): CollectionConfig<InferSchemaOutput<TSchema>, string | number, TSchema> & {
	utils: MemoryUtils;
	schema: TSchema;
} {
	type TItem = InferSchemaOutput<TSchema>;
	let syncParams: Parameters<SyncConfig<TItem>["sync"]>[0] | null = null;

	const sync: SyncConfig<TItem>["sync"] = (params) => {
		syncParams = params;

		params.markReady();

		// Return cleanup function
		return () => {};
	};

	// All mutation handlers use the same transaction sender
	const onInsert = async (params: InsertMutationFnParams<TItem>) => {
		if (!syncParams) {
			throw new Error("Sync parameters not initialized");
		}
		syncParams.begin();
		for (const mutation of params.transaction.mutations) {
			syncParams.write({
				type: "insert",
				value: mutation.modified,
			});
		}
		syncParams.commit();
	};

	const onUpdate = async (params: UpdateMutationFnParams<TItem>) => {
		if (!syncParams) {
			throw new Error("Sync parameters not initialized");
		}
		syncParams.begin();
		for (const mutation of params.transaction.mutations) {
			syncParams.write({
				type: "update",
				value: mutation.modified,
				previousValue: mutation.original,
			});
		}
		syncParams.commit();
	};

	const onDelete = async (params: DeleteMutationFnParams<TItem>) => {
		if (!syncParams) {
			throw new Error("Sync parameters not initialized");
		}
		syncParams.begin();
		for (const mutation of params.transaction.mutations) {
			syncParams.write({
				type: "delete",
				key: mutation.key,
			});
		}
		syncParams?.commit();
	};

	const truncate = async () => {
		if (!syncParams) {
			throw new Error("Sync parameters not initialized");
		}
		syncParams.begin();
		syncParams.truncate();
		syncParams.commit();
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
		},
	};
}

export type MemoryCollection<TSchema extends StandardSchemaV1> = Collection<
	InferSchemaOutput<TSchema>,
	string | number,
	MemoryUtils,
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
