import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
	type Collection,
	type CollectionConfig,
	createCollection,
	type InferSchemaInput,
	type InferSchemaOutput,
	type IR,
	type SyncMode,
	parseOrderByExpression,
} from "@tanstack/db";
import type { SyncMessage, CollectionUtils } from "@firtoz/db-helpers";
import { evaluateExpression } from "@firtoz/db-helpers";
import {
	type GenericBaseSyncConfig,
	type GenericSyncBackend,
	type GenericSyncFunctionResult,
	createGenericSyncFunction,
	createGenericCollectionConfig,
} from "@firtoz/db-helpers";

/**
 * Minimal key-value storage adapter.
 * Compatible with idb-keyval (almost directly) and localforage (via thin wrapper).
 */
export interface KeyValAdapter<T = unknown> {
	get(key: string): Promise<T | null | undefined>;
	set(key: string, value: T): Promise<void>;
	del(key: string): Promise<void>;
	entries(): Promise<[string, T][]>;
	clear(): Promise<void>;
	/** Optional batch set for performance. Falls back to sequential set() calls. */
	setMany?(entries: [string, T][]): Promise<void>;
	/** Optional batch delete for performance. Falls back to sequential del() calls. */
	delMany?(keys: string[]): Promise<void>;
}

export interface KeyValCollectionConfig<TSchema extends StandardSchemaV1> {
	schema: TSchema;
	adapter: KeyValAdapter<InferSchemaOutput<TSchema>>;
	/** Extracts the key from an item. Defaults to `(item) => item.id`. */
	getKey?: (item: InferSchemaOutput<TSchema>) => string;
	/** Promise that resolves when the adapter is ready. Defaults to resolved. */
	readyPromise?: Promise<void>;
	syncMode?: SyncMode;
	debug?: boolean;
	/** Called when a local mutation is persisted; use to broadcast to other peers/tabs. */
	onBroadcast?: (
		changes: SyncMessage<InferSchemaOutput<TSchema>, string | number>[],
	) => void;
}

type KeyValUtils<TItem> = CollectionUtils<TItem>;

function defaultGetKey<TSchema extends StandardSchemaV1>(
	item: InferSchemaOutput<TSchema>,
): string {
	return (item as { id: string }).id;
}

export function keyvalCollectionOptions<TSchema extends StandardSchemaV1>(
	config: KeyValCollectionConfig<TSchema>,
): CollectionConfig<InferSchemaOutput<TSchema>, string, TSchema> & {
	utils: KeyValUtils<InferSchemaOutput<TSchema>>;
	schema: TSchema;
} {
	type TItem = InferSchemaOutput<TSchema>;

	const adapter = config.adapter;
	const getKey = config.getKey ?? defaultGetKey<TSchema>;
	const readyPromise = config.readyPromise ?? Promise.resolve();

	const adapterSetMany = async (entries: [string, TItem][]) => {
		if (adapter.setMany) {
			await adapter.setMany(entries);
		} else {
			for (const [key, value] of entries) {
				await adapter.set(key, value);
			}
		}
	};

	const adapterDelMany = async (keys: string[]) => {
		if (adapter.delMany) {
			await adapter.delMany(keys);
		} else {
			for (const key of keys) {
				await adapter.del(key);
			}
		}
	};

	const backend: GenericSyncBackend<TItem> = {
		initialLoad: async () => {
			const allEntries = await adapter.entries();
			return allEntries.map(([, value]) => value);
		},

		loadSubset: async (options) => {
			const allEntries = await adapter.entries();
			let items = allEntries.map(([, value]) => value);

			let combinedWhere = options.where;
			if (options.cursor?.whereFrom) {
				if (combinedWhere) {
					combinedWhere = {
						type: "func",
						name: "and",
						args: [combinedWhere, options.cursor.whereFrom],
					} as IR.Func;
				} else {
					combinedWhere = options.cursor.whereFrom;
				}
			}

			if (combinedWhere) {
				const whereExpression = combinedWhere;
				items = items.filter((item) =>
					evaluateExpression(whereExpression, item as Record<string, unknown>),
				);
			}

			if (options.orderBy) {
				const sorts = parseOrderByExpression(options.orderBy);
				items.sort((a, b) => {
					for (const sort of sorts) {
						// biome-ignore lint/suspicious/noExplicitAny: Need any for dynamic field access
						let aValue: any = a;
						// biome-ignore lint/suspicious/noExplicitAny: Need any for dynamic field access
						let bValue: any = b;
						for (const fieldName of sort.field) {
							aValue = aValue?.[fieldName];
							bValue = bValue?.[fieldName];
						}

						if (aValue < bValue) {
							return sort.direction === "asc" ? -1 : 1;
						}
						if (aValue > bValue) {
							return sort.direction === "asc" ? 1 : -1;
						}
					}
					return 0;
				});
			}

			if (options.offset !== undefined && options.offset > 0) {
				items = items.slice(options.offset);
			}

			if (options.limit !== undefined) {
				items = items.slice(0, options.limit);
			}

			return items;
		},

		handleInsert: async (itemsToInsert) => {
			const entries: [string, TItem][] = itemsToInsert.map((item) => [
				getKey(item),
				item,
			]);
			await adapterSetMany(entries);
			return itemsToInsert;
		},

		handleUpdate: async (mutations) => {
			const results: TItem[] = [];
			const entriesToSet: [string, TItem][] = [];

			for (const mutation of mutations) {
				const existing = await adapter.get(mutation.key);
				if (existing) {
					const updatedItem = {
						...existing,
						...mutation.changes,
					} as TItem;
					entriesToSet.push([mutation.key, updatedItem]);
					results.push(updatedItem);
				} else {
					results.push(mutation.original);
				}
			}

			if (entriesToSet.length > 0) {
				await adapterSetMany(entriesToSet);
			}

			return results;
		},

		handleDelete: async (mutations) => {
			const keysToDelete = mutations.map((m) => m.key);
			await adapterDelMany(keysToDelete);
		},

		handleTruncate: async () => {
			await adapter.clear();
		},
	};

	const wrappedBackend: GenericSyncBackend<TItem> = {
		...backend,
		initialLoad: async () => {
			if (config.syncMode === "eager" || !config.syncMode) {
				return await backend.initialLoad();
			}
			return [];
		},
	};

	const baseSyncConfig: GenericBaseSyncConfig = {
		readyPromise,
		syncMode: config.syncMode,
		debug: config.debug,
	};

	const syncResult: GenericSyncFunctionResult<TItem> =
		createGenericSyncFunction(baseSyncConfig, wrappedBackend);

	return createGenericCollectionConfig<TItem, TSchema>({
		schema: config.schema,
		getKey,
		syncResult,
		syncMode: config.syncMode,
		onInsert: async (params) => {
			await syncResult.onInsert?.(params);
			const writes: SyncMessage<TItem, string>[] =
				params.transaction.mutations.map((mutation) => ({
					type: "insert",
					value: mutation.modified,
				}));
			config.onBroadcast?.(writes);
		},
		onUpdate: async (params) => {
			await syncResult.onUpdate?.(params);
			const writes: SyncMessage<TItem, string>[] =
				params.transaction.mutations.map((mutation) => ({
					type: "update",
					value: mutation.modified,
					previousValue: mutation.original,
				}));
			config.onBroadcast?.(writes);
		},
		onDelete: async (params) => {
			await syncResult.onDelete?.(params);
			const writes: SyncMessage<TItem, string>[] =
				params.transaction.mutations.map((mutation) => ({
					type: "delete",
					key: mutation.key,
				}));
			config.onBroadcast?.(writes);
		},
	});
}

export type KeyValCollection<TSchema extends StandardSchemaV1> = Collection<
	InferSchemaOutput<TSchema>,
	string,
	KeyValUtils<InferSchemaOutput<TSchema>>,
	TSchema,
	InferSchemaInput<TSchema>
>;

export function createKeyValCollection<TSchema extends StandardSchemaV1>(
	config: KeyValCollectionConfig<TSchema>,
): KeyValCollection<TSchema> {
	return createCollection(
		keyvalCollectionOptions(config),
	) as KeyValCollection<TSchema>;
}
