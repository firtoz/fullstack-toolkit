import type { CollectionUtils, SyncMessage } from "./sync-types";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
	CollectionConfig,
	InferSchemaOutput,
	SyncConfig,
	SyncConfigRes,
	SyncMode,
	LoadSubsetOptions,
} from "@tanstack/db";
import { DeduplicatedLoadSubset } from "@tanstack/db";

// WORKAROUND: DeduplicatedLoadSubset has a bug where toggling queries (e.g., isNull/isNotNull)
// creates invalid expressions like not(or(isNull(...), not(isNull(...))))
// See: https://github.com/TanStack/db/issues/828
// TODO: Re-enable once the bug is fixed
export const USE_DEDUPE = false as boolean;

/**
 * Base configuration for sync lifecycle management (generic, no Drizzle dependency).
 */
export interface GenericBaseSyncConfig {
	readyPromise: Promise<void>;
	syncMode?: SyncMode;
	debug?: boolean;
}

/**
 * Backend-specific implementations required for sync (generic, no Drizzle dependency).
 */
export interface GenericSyncBackend<TItem extends object> {
	initialLoad: () => Promise<Array<TItem>>;
	loadSubset: (options: LoadSubsetOptions) => Promise<Array<TItem>>;
	handleInsert: (items: Array<TItem>) => Promise<Array<TItem>>;
	handleUpdate: (
		mutations: Array<{
			key: string;
			changes: Partial<TItem>;
			original: TItem;
		}>,
	) => Promise<Array<TItem>>;
	handleDelete: (
		mutations: Array<{
			key: string;
			modified: TItem;
			original: TItem;
		}>,
	) => Promise<void>;
	handleTruncate?: () => Promise<void>;
}

/**
 * Return type for createGenericSyncFunction.
 */
export type GenericSyncFunctionResult<TItem extends object> = {
	sync: SyncConfig<TItem, string>["sync"];
	onInsert: CollectionConfig<
		TItem,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>["onInsert"];
	onUpdate: CollectionConfig<
		TItem,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>["onUpdate"];
	onDelete: CollectionConfig<
		TItem,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>["onDelete"];
	utils: CollectionUtils<TItem>;
};

/**
 * Creates the sync function with common lifecycle management.
 * Generic version -- no Drizzle dependency.
 */
export function createGenericSyncFunction<TItem extends object>(
	config: GenericBaseSyncConfig,
	backend: GenericSyncBackend<TItem>,
): GenericSyncFunctionResult<TItem> {
	type CollectionType = CollectionConfig<
		TItem,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>;

	let insertListener: CollectionType["onInsert"];
	let updateListener: CollectionType["onUpdate"];
	let deleteListener: CollectionType["onDelete"];

	let syncBegin: (() => void) | null = null;
	let syncWrite:
		| ((op: { type: "insert" | "update" | "delete"; value: TItem }) => void)
		| null = null;
	let syncCommit: (() => void) | null = null;
	let syncTruncate: (() => void) | null = null;

	const syncFn: SyncConfig<TItem, string>["sync"] = (params) => {
		const { begin, write, commit, markReady, truncate } = params;

		syncBegin = begin;
		syncWrite = write;
		syncCommit = commit;
		syncTruncate = truncate;

		const initialSync = async () => {
			await config.readyPromise;

			try {
				const items = await backend.initialLoad();

				begin();

				for (const item of items) {
					write({
						type: "insert",
						value: item,
					});
				}

				commit();
			} finally {
				markReady();
			}
		};

		if (config.syncMode === "eager" || !config.syncMode) {
			initialSync();
		} else {
			markReady();
		}

		insertListener = async (params) => {
			const results = await backend.handleInsert(
				params.transaction.mutations.map((m) => m.modified),
			);

			begin();
			for (const result of results) {
				write({
					type: "insert",
					value: result,
				});
			}
			commit();
		};

		updateListener = async (params) => {
			const results = await backend.handleUpdate(params.transaction.mutations);

			begin();
			for (const result of results) {
				write({
					type: "update",
					value: result,
				});
			}
			commit();
		};

		deleteListener = async (params) => {
			await backend.handleDelete(params.transaction.mutations);

			begin();
			for (const item of params.transaction.mutations) {
				write({
					type: "delete",
					value: item.modified,
				});
			}
			commit();
		};

		const loadSubset = async (options: LoadSubsetOptions) => {
			await config.readyPromise;

			const items = await backend.loadSubset(options);

			begin();

			for (const item of items) {
				write({
					type: "insert",
					value: item,
				});
			}

			commit();
		};

		let loadSubsetDedupe: DeduplicatedLoadSubset | null = null;
		if (USE_DEDUPE) {
			loadSubsetDedupe = new DeduplicatedLoadSubset({
				loadSubset,
			});
		}

		return {
			cleanup: () => {
				insertListener = undefined;
				updateListener = undefined;
				deleteListener = undefined;
				loadSubsetDedupe?.reset();
			},
			loadSubset: loadSubsetDedupe?.loadSubset ?? loadSubset,
		} satisfies SyncConfigRes;
	};

	const receiveSync = async (messages: SyncMessage<TItem>[]) => {
		if (messages.length === 0) return;
		if (!syncBegin || !syncWrite || !syncCommit || !syncTruncate) {
			if (config.debug) {
				console.warn(
					"[receiveSync] Sync functions not initialized yet - messages will be dropped",
					messages.length,
				);
			}
			return;
		}
		syncBegin();
		for (const msg of messages) {
			switch (msg.type) {
				case "insert":
					syncWrite({ type: "insert", value: msg.value });
					break;
				case "update":
					syncWrite({ type: "update", value: msg.value });
					break;
				case "delete":
					syncWrite({
						type: "delete",
						value: { id: msg.key } as TItem,
					});
					break;
				case "truncate":
					syncTruncate();
					break;
				default:
					exhaustiveGuard(msg);
			}
		}
		syncCommit();
	};

	const utils: CollectionUtils<TItem> = {
		truncate: async () => {
			if (!backend.handleTruncate) {
				throw new Error("Truncate not supported by this backend");
			}
			if (!syncBegin || !syncTruncate || !syncCommit) {
				throw new Error(
					"Sync functions not initialized - sync function may not have been called yet",
				);
			}
			await backend.handleTruncate();
			syncBegin();
			syncTruncate();
			syncCommit();
		},
		receiveSync,
	};

	return {
		sync: syncFn,
		onInsert: async (params) => {
			if (!insertListener) {
				throw new Error(
					"insertListener not initialized - sync function may not have been called yet",
				);
			}
			return insertListener(params);
		},
		onUpdate: async (params) => {
			if (!updateListener) {
				throw new Error(
					"updateListener not initialized - sync function may not have been called yet",
				);
			}
			return updateListener(params);
		},
		onDelete: async (params) => {
			if (!deleteListener) {
				throw new Error(
					"deleteListener not initialized - sync function may not have been called yet",
				);
			}
			return deleteListener(params);
		},
		utils,
	};
}

/**
 * Generic collection config factory.
 * Combines schema, sync, and event handlers into a collection config.
 * No Drizzle dependency -- uses StandardSchemaV1 directly.
 */
export function createGenericCollectionConfig<
	TItem extends object,
	TSchema extends StandardSchemaV1,
>(config: {
	schema: TSchema;
	getKey: (item: TItem) => string;
	syncResult: GenericSyncFunctionResult<TItem>;
	onInsert?: CollectionConfig<
		TItem,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>["onInsert"];
	onUpdate?: CollectionConfig<
		TItem,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>["onUpdate"];
	onDelete?: CollectionConfig<
		TItem,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Schema type parameter needs to be flexible
		any
	>["onDelete"];
	syncMode?: SyncMode;
}): Omit<
	CollectionConfig<
		TItem,
		string,
		TSchema,
		CollectionUtils<InferSchemaOutput<TSchema>>
	>,
	"utils"
> & {
	schema: TSchema;
	utils: CollectionUtils<InferSchemaOutput<TSchema>>;
} {
	return {
		schema: config.schema,
		getKey: config.getKey,
		sync: {
			sync: config.syncResult.sync,
		},
		onInsert: config.onInsert ?? config.syncResult.onInsert,
		onUpdate: config.onUpdate ?? config.syncResult.onUpdate,
		onDelete: config.onDelete ?? config.syncResult.onDelete,
		syncMode: config.syncMode,
		utils: config.syncResult.utils as CollectionUtils<
			InferSchemaOutput<TSchema>
		>,
	};
}
