import type {
	CollectionUtils,
	ReceiveSyncDurableOp,
	SyncMessage,
} from "./sync-types";
import { DeferredWriteQueue } from "./deferred-write-queue";
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
export interface GenericBaseSyncConfig<TItem extends object = object> {
	readyPromise: Promise<void>;
	syncMode?: SyncMode;
	debug?: boolean;
	/**
	 * Row key for durable storage when applying {@link CollectionUtils.receiveSync} updates.
	 * If omitted, `id` on the item (string or number) is used.
	 */
	getSyncPersistKey?: (item: TItem) => string;
	/**
	 * When set, local `onInsert` / `onUpdate` / `onDelete` confirm TanStack sync state immediately
	 * and enqueue durable backend writes (coalesced, flushed on an interval). `receiveSync`,
	 * `loadSubset`, and `truncate` flush the queue first so reads stay consistent.
	 */
	deferLocalPersistence?: boolean | { flushIntervalMs?: number };
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
	/**
	 * When set, {@link CollectionUtils.receiveSync} persists an entire message batch with one call
	 * (e.g. one SQLite transaction) instead of awaiting {@link handleInsert}/handleUpdate per
	 * message. TanStack `syncWrite`/`syncTruncate` still run once per message in order.
	 */
	applyReceiveSyncDurableWrites?: (
		ops: ReceiveSyncDurableOp<TItem>[],
	) => Promise<void>;
	/**
	 * Optional batch upsert for deferred local persistence flushes (e.g. IndexedDB `put` in one tx).
	 */
	handleBatchPut?: (items: Array<TItem>) => Promise<void>;
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
	config: GenericBaseSyncConfig<TItem>,
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
	/** Resolves when eager `initialSync` has finished (or immediately in on-demand mode). Used so `receiveSync` cannot interleave with initial inserts. */
	let initialSyncDone: Promise<void> | null = null;
	/**
	 * TanStack DB allows only one pending sync transaction per collection. Every path that calls
	 * `begin`/`commit` — `initialSync`, `loadSubset`, `onInsert`/`onUpdate`/`onDelete`, `receiveSync`,
	 * and `truncate` — must run through this queue so async backends (e.g. SQLite WASM) cannot
	 * leave a transaction open across an `await` while another path starts a second transaction.
	 */
	let syncLayerSerial: Promise<void> = Promise.resolve();

	const enqueueSyncLayer = (run: () => void | Promise<void>): Promise<void> => {
		const next = syncLayerSerial.catch(() => {}).then(run);
		syncLayerSerial = next;
		return next;
	};

	function resolveDeferLocalPersistence(
		opts: GenericBaseSyncConfig<TItem>["deferLocalPersistence"],
	): { enabled: boolean; flushIntervalMs: number } {
		if (opts === true) return { enabled: true, flushIntervalMs: 100 };
		if (typeof opts === "object" && opts !== null) {
			return { enabled: true, flushIntervalMs: opts.flushIntervalMs ?? 100 };
		}
		return { enabled: false, flushIntervalMs: 100 };
	}

	const deferOpts = resolveDeferLocalPersistence(config.deferLocalPersistence);

	const resolveDeferredPersistKey = (item: TItem): string => {
		if (config.getSyncPersistKey !== undefined) {
			return config.getSyncPersistKey(item);
		}
		if (item !== null && typeof item === "object" && "id" in item) {
			const id = (item as { id: unknown }).id;
			if (typeof id === "string" || typeof id === "number") {
				return String(id);
			}
		}
		throw new Error(
			"[deferLocalPersistence] Persist key missing: set GenericBaseSyncConfig.getSyncPersistKey or use items with string/number `id`",
		);
	};

	let deferQueue: DeferredWriteQueue<TItem> | null = null;
	if (deferOpts.enabled) {
		deferQueue = new DeferredWriteQueue({
			backend,
			getPersistKey: resolveDeferredPersistKey,
			flushIntervalMs: deferOpts.flushIntervalMs,
		});
	}

	const syncFn: SyncConfig<TItem, string>["sync"] = (params) => {
		const { begin, write, commit, markReady, truncate } = params;

		syncBegin = begin;
		syncWrite = write;
		syncCommit = commit;
		syncTruncate = truncate;

		const initialSync = async () => {
			await enqueueSyncLayer(async () => {
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
			});
		};

		if (config.syncMode === "eager" || !config.syncMode) {
			initialSyncDone = initialSync();
		} else {
			markReady();
			initialSyncDone = Promise.resolve();
		}

		insertListener = async (params) => {
			await enqueueSyncLayer(async () => {
				const items = params.transaction.mutations.map((m) => m.modified);
				if (deferQueue !== null) {
					begin();
					for (const item of items) {
						write({
							type: "insert",
							value: item,
						});
					}
					commit();
					deferQueue.enqueueInsert(items);
					return;
				}

				const results = await backend.handleInsert(items);

				begin();
				for (const result of results) {
					write({
						type: "insert",
						value: result,
					});
				}
				commit();
			});
		};

		updateListener = async (params) => {
			await enqueueSyncLayer(async () => {
				if (deferQueue !== null) {
					const mutations = params.transaction.mutations.map((m) => ({
						key: String(m.key),
						changes: m.changes as Partial<TItem>,
						original: m.original as TItem,
					}));
					const results = mutations.map(
						(m) => ({ ...m.original, ...m.changes }) as TItem,
					);
					begin();
					for (const result of results) {
						write({
							type: "update",
							value: result,
						});
					}
					commit();
					deferQueue.enqueueUpdate(mutations);
					return;
				}

				const results = await backend.handleUpdate(
					params.transaction.mutations,
				);

				begin();
				for (const result of results) {
					write({
						type: "update",
						value: result,
					});
				}
				commit();
			});
		};

		deleteListener = async (params) => {
			await enqueueSyncLayer(async () => {
				if (deferQueue !== null) {
					const mutations = params.transaction.mutations.map((m) => ({
						key: String(m.key),
						modified: m.modified as TItem,
						original: m.original as TItem,
					}));
					begin();
					for (const item of mutations) {
						write({
							type: "delete",
							value: item.modified,
						});
					}
					commit();
					deferQueue.enqueueDelete(mutations);
					return;
				}

				await backend.handleDelete(params.transaction.mutations);

				begin();
				for (const item of params.transaction.mutations) {
					write({
						type: "delete",
						value: item.modified,
					});
				}
				commit();
			});
		};

		const loadSubset = async (options: LoadSubsetOptions) => {
			await enqueueSyncLayer(async () => {
				await config.readyPromise;

				if (deferQueue !== null) {
					await deferQueue.flush();
				}

				const items = await backend.loadSubset(options);

				begin();

				for (const item of items) {
					write({
						type: "insert",
						value: item,
					});
				}

				commit();
			});
		};

		let loadSubsetDedupe: DeduplicatedLoadSubset | null = null;
		if (USE_DEDUPE) {
			loadSubsetDedupe = new DeduplicatedLoadSubset({
				loadSubset,
			});
		}

		return {
			cleanup: () => {
				deferQueue?.dispose();
				deferQueue = null;
				insertListener = undefined;
				updateListener = undefined;
				deleteListener = undefined;
				loadSubsetDedupe?.reset();
			},
			loadSubset: loadSubsetDedupe?.loadSubset ?? loadSubset,
		} satisfies SyncConfigRes;
	};

	const resolveReceiveSyncPersistKey = (item: TItem): string => {
		if (config.getSyncPersistKey !== undefined) {
			return config.getSyncPersistKey(item);
		}
		if (item !== null && typeof item === "object" && "id" in item) {
			const id = (item as { id: unknown }).id;
			if (typeof id === "string" || typeof id === "number") {
				return String(id);
			}
		}
		throw new Error(
			"[receiveSync] Persist key missing: set GenericBaseSyncConfig.getSyncPersistKey or use items with string/number `id`",
		);
	};

	const shallowRecordDiff = (previous: TItem, next: TItem): Partial<TItem> => {
		const out: Partial<TItem> = {};
		if (
			previous !== null &&
			typeof previous === "object" &&
			next !== null &&
			typeof next === "object"
		) {
			const prevRec = previous as Record<string, unknown>;
			const nextRec = next as Record<string, unknown>;
			for (const k of Object.keys(nextRec)) {
				if (prevRec[k] !== nextRec[k]) {
					(out as Record<string, unknown>)[k] = nextRec[k];
				}
			}
		}
		return out;
	};

	const toReceiveSyncDurableOps = (
		messages: SyncMessage<TItem>[],
	): ReceiveSyncDurableOp<TItem>[] => {
		const out: ReceiveSyncDurableOp<TItem>[] = [];
		for (const msg of messages) {
			switch (msg.type) {
				case "insert":
					out.push({ type: "insert", value: msg.value });
					break;
				case "update":
					out.push({
						type: "update",
						key: resolveReceiveSyncPersistKey(msg.value),
						changes: shallowRecordDiff(
							msg.previousValue,
							msg.value,
						) as Partial<TItem>,
						original: msg.previousValue,
					});
					break;
				case "delete":
					out.push({ type: "delete", key: String(msg.key) });
					break;
				case "truncate":
					out.push({ type: "truncate" });
					break;
				default:
					exhaustiveGuard(msg);
			}
		}
		return out;
	};

	const receiveSync = async (messages: SyncMessage<TItem>[]) => {
		if (messages.length === 0) return;

		await enqueueSyncLayer(async () => {
			if (initialSyncDone) {
				await initialSyncDone;
			}
			if (!syncBegin || !syncWrite || !syncCommit || !syncTruncate) {
				if (config.debug) {
					console.warn(
						"[receiveSync] Sync functions not initialized yet - messages will be dropped",
						messages.length,
					);
				}
				return;
			}
			if (deferQueue !== null) {
				await deferQueue.flush();
			}
			syncBegin();

			try {
				const applyBatch = backend.applyReceiveSyncDurableWrites;
				if (applyBatch !== undefined) {
					await applyBatch(toReceiveSyncDurableOps(messages));
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
				} else {
					for (const msg of messages) {
						switch (msg.type) {
							case "insert":
								await backend.handleInsert([msg.value]);
								syncWrite({ type: "insert", value: msg.value });
								break;
							case "update": {
								const key = resolveReceiveSyncPersistKey(msg.value);
								await backend.handleUpdate([
									{
										key,
										changes: shallowRecordDiff(
											msg.previousValue,
											msg.value,
										) as Partial<TItem>,
										original: msg.previousValue,
									},
								]);
								syncWrite({ type: "update", value: msg.value });
								break;
							}
							case "delete":
								await backend.handleDelete([
									{
										key: String(msg.key),
										modified: { id: msg.key } as TItem,
										original: { id: msg.key } as TItem,
									},
								]);
								syncWrite({
									type: "delete",
									value: { id: msg.key } as TItem,
								});
								break;
							case "truncate":
								if (backend.handleTruncate) {
									await backend.handleTruncate();
								}
								syncTruncate();
								break;
							default:
								exhaustiveGuard(msg);
						}
					}
				}
			} catch (err) {
				console.error(
					"[receiveSync] error during sync writes, committing partial batch to avoid leaving transaction open",
					err,
				);
			}
			syncCommit();
		});
	};

	const utils: CollectionUtils<TItem> = {
		truncate: async () => {
			const handleTruncate = backend.handleTruncate;
			if (!handleTruncate) {
				throw new Error("Truncate not supported by this backend");
			}
			if (!syncBegin || !syncTruncate || !syncCommit) {
				throw new Error(
					"Sync functions not initialized - sync function may not have been called yet",
				);
			}
			await enqueueSyncLayer(async () => {
				if (deferQueue !== null) {
					await deferQueue.flush();
				}
				await handleTruncate();
				const begin = syncBegin;
				const trunc = syncTruncate;
				const commit = syncCommit;
				if (!begin || !trunc || !commit) {
					throw new Error(
						"Sync functions not initialized - sync function may not have been called yet",
					);
				}
				begin();
				trunc();
				commit();
			});
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
