import type { SyncMessage } from "@firtoz/db-helpers";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
	CollectionConfig,
	NonSingleResult,
	UtilsRecord,
} from "@tanstack/db";
import { SyncClientBridge } from "./sync-client-bridge";
import type { PartialSyncRowId } from "./partial-sync-row-key";
import type { SyncClientMessage } from "./sync-protocol";

/**
 * Sync cursor persistence (see {@link WithSyncOptions}):
 *
 * - **Ephemeral collections** (in-memory only, no durable row storage): omit `syncStateKey`.
 *   Each load gets a new `clientId` and `lastAckedServerVersion: 0`, so the server answers with a
 *   **full snapshot** backfill — correct because local rows do not survive refresh.
 *
 * - **Durable collections** (IndexedDB, sqlite-wasm, etc.): set `syncStateKey` (and default storage).
 *   `persistLastAckedServerVersion` defaults to **true**, so reconnect sends the last acked server
 *   version and the server can return **delta** backfill when the changelog allows.
 *
 * - To keep a stable `clientId` in storage but **always** request a full snapshot (rare), set
 *   `syncStateKey` and `persistLastAckedServerVersion: false`.
 */

/** Row shape required for sync (matches {@link SyncClientBridge}). */
export type SyncableCollectionItem = {
	id: PartialSyncRowId;
	updatedAt?: number | Date | null;
};

/**
 * Key/value persistence for sync metadata (`clientId`, `lastAckedServerVersion`).
 * Same shape as `Storage`; use `localStorage`, `sessionStorage`, a `Map` adapter, etc.
 */
export type SyncStateStorage = {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
};

export type WithSyncOptions = {
	/**
	 * If set, sync metadata (`clientId`, optionally `lastAckedServerVersion`) is read/written via
	 * {@link syncStateStorage} or `localStorage`. Omit for ephemeral collections (e.g. memory) so
	 * every load handshakes as a fresh client with a full snapshot — see module note above.
	 */
	syncStateKey?: string;
	/**
	 * Where to read/write {@link syncStateKey}. Defaults to `globalThis.localStorage` when `syncStateKey` is set and this is omitted.
	 * Pass `null` to skip persistence even when `syncStateKey` is set (e.g. tests).
	 */
	syncStateStorage?: SyncStateStorage | null;
	/**
	 * Persist and reuse lastAcked server version across page reloads (enables delta backfill on reconnect).
	 * Defaults to `true` when {@link syncStateKey} is set and a storage backend is resolved; set `false` to always handshake with `lastAckedServerVersion: 0` (full snapshot). When `false`, existing stored `lastAckedServerVersion` is preserved in storage so it is not wiped on load.
	 */
	persistLastAckedServerVersion?: boolean;
	onRejectedMutation?: (reason: string, mutationId: string) => void;
	/**
	 * When `false`, the bridge does not send `syncHello` on connect (use with partial sync + `mutateBatch`).
	 * Default `true`.
	 */
	sendSyncHelloOnConnect?: boolean;
	/**
	 * When `false`, local {@link CollectionConfig.utils.truncate} clears storage only — it does **not**
	 * enqueue a `truncate` for the next `mutateBatch`. Partial sync calls truncate on window reset; forwarding
	 * it would batch with unrelated user edits and make the server apply `truncate` + `update`, wiping data.
	 * Default `true` (full sync). {@link createPartialSyncedCollection} sets this to `false`.
	 */
	forwardTruncateToMutations?: boolean;
};

/** Returns `globalThis.localStorage` when it looks usable; otherwise `null`. */
export function getBrowserLocalStorageSyncStateStorage(): SyncStateStorage | null {
	const g = globalThis as typeof globalThis & {
		localStorage?: SyncStateStorage;
	};
	const ls = g.localStorage;
	if (!ls || typeof ls.getItem !== "function") return null;
	return ls;
}

function resolveSyncStateStorage(
	syncOptions: WithSyncOptions | undefined,
): SyncStateStorage | null {
	if (typeof syncOptions?.syncStateKey !== "string") return null;
	if (syncOptions.syncStateStorage !== undefined) {
		return syncOptions.syncStateStorage;
	}
	return getBrowserLocalStorageSyncStateStorage();
}

/**
 * Infer the collection row type from options passed to {@link withSync} / {@link createSyncedCollection}.
 * Prefer `CollectionConfig`'s first type parameter (the select row). That matches Drizzle SQLite configs
 * where `schema` is an insert schema whose {@link InferSchemaOutput} can differ from the row type.
 */
export type InferItemFromCollectionOptions<T> = T extends Omit<
	CollectionConfig<infer TItem, infer _K, infer _S, infer _U>,
	"utils"
> & { utils: UtilsRecord }
	? TItem
	: T extends WithSyncableCollectionConfig<
				infer TItem,
				infer _K,
				infer _S,
				infer _U
			>
		? TItem
		: T extends CollectionConfig<
					infer TItem,
					infer _TKey,
					infer _TSchema,
					infer _TUtils
				>
			? TItem
			: T extends { getKey: (item: infer I) => unknown }
				? I
				: never;

/**
 * Any TanStack {@link CollectionConfig} (from memory / IndexedDB / SQLite helpers, etc.)
 * that is not a single-row collection. Requires `utils` (sync backends always provide it).
 */
export type WithSyncableCollectionConfig<
	TItem extends SyncableCollectionItem = SyncableCollectionItem,
	TKey extends string | number = string | number,
	TSchema extends StandardSchemaV1 = never,
	TUtils extends UtilsRecord = UtilsRecord,
> = Omit<CollectionConfig<TItem, TKey, TSchema, TUtils>, "utils"> &
	NonSingleResult & {
		utils: TUtils;
	};

type PersistedSyncState = {
	clientId: string;
	lastAckedServerVersion: number;
};

function readPersistedSyncState(
	key: string,
	storage: SyncStateStorage | null,
): PersistedSyncState | null {
	if (!storage) return null;
	try {
		const raw = storage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<PersistedSyncState>;
		if (typeof parsed.clientId !== "string") return null;
		return {
			clientId: parsed.clientId,
			lastAckedServerVersion:
				typeof parsed.lastAckedServerVersion === "number"
					? parsed.lastAckedServerVersion
					: 0,
		};
	} catch {
		return null;
	}
}

function writePersistedSyncState(
	key: string,
	storage: SyncStateStorage | null,
	state: PersistedSyncState,
): void {
	if (!storage) return;
	try {
		storage.setItem(key, JSON.stringify(state));
	} catch {
		// ignore quota / private mode
	}
}

/**
 * Wraps TanStack DB collection options so local mutations are forwarded to {@link SyncClientBridge}.
 * Pair with {@link connectSync} or {@link createSyncedCollection} to attach a WebSocket transport.
 *
 * Row type is inferred from your collection config via {@link InferItemFromCollectionOptions}.
 */
/** Widened config union from memory / Drizzle / IndexedDB helpers. */
export type AnyWithSyncableCollectionConfig = WithSyncableCollectionConfig<
	// biome-ignore lint/suspicious/noExplicitAny: item type slot for heterogeneous backends
	any,
	// biome-ignore lint/suspicious/noExplicitAny: key type slot
	any,
	// biome-ignore lint/suspicious/noExplicitAny: schema type slot
	any,
	// biome-ignore lint/suspicious/noExplicitAny: utils type slot
	any
>;

export function withSync<TConfig extends AnyWithSyncableCollectionConfig>(
	baseOptions: TConfig,
	syncOptions?: WithSyncOptions,
): {
	options: TConfig;
	bridge: SyncClientBridge<InferItemFromCollectionOptions<TConfig>>;
	setTransportSend: (send: (msg: SyncClientMessage) => void) => void;
} {
	type TItem = InferItemFromCollectionOptions<TConfig>;

	const syncStateKey = syncOptions?.syncStateKey;
	const syncStateStorage = resolveSyncStateStorage(syncOptions);

	const persisted =
		typeof syncStateKey === "string"
			? readPersistedSyncState(syncStateKey, syncStateStorage)
			: null;
	const shouldPersistLastAckedServerVersion =
		syncOptions?.persistLastAckedServerVersion ??
		(typeof syncStateKey === "string" && syncStateStorage !== null);
	const clientId = persisted?.clientId ?? `client-${crypto.randomUUID()}`;
	const persistedLastAcked = persisted?.lastAckedServerVersion ?? 0;
	let lastAckedServerVersion = shouldPersistLastAckedServerVersion
		? persistedLastAcked
		: 0;
	if (typeof syncStateKey === "string") {
		writePersistedSyncState(syncStateKey, syncStateStorage, {
			clientId,
			lastAckedServerVersion: shouldPersistLastAckedServerVersion
				? lastAckedServerVersion
				: persistedLastAcked,
		});
	}

	let transportSend: (msg: SyncClientMessage) => void = () => {};

	const forwardTruncateToMutations =
		syncOptions?.forwardTruncateToMutations ?? true;

	const originalReceiveSync = baseOptions.utils.receiveSync.bind(
		baseOptions.utils,
	);
	const originalTruncate = baseOptions.utils.truncate.bind(baseOptions.utils);

	const bridge = new SyncClientBridge<TItem>({
		clientId,
		collection: {
			utils: {
				receiveSync: originalReceiveSync,
			},
		},
		send: (message) => transportSend(message),
		initialLastAckedServerVersion: lastAckedServerVersion,
		onLastAckedServerVersionChange: (version) => {
			lastAckedServerVersion = Math.max(lastAckedServerVersion, version);
			if (typeof syncStateKey === "string") {
				writePersistedSyncState(syncStateKey, syncStateStorage, {
					clientId,
					lastAckedServerVersion,
				});
			}
		},
		onRejectedMutation: syncOptions?.onRejectedMutation,
		sendSyncHelloOnConnect: syncOptions?.sendSyncHelloOnConnect,
	});

	const onInsert = baseOptions.onInsert
		? async (params: Parameters<NonNullable<TConfig["onInsert"]>>[0]) => {
				await baseOptions.onInsert?.(params);
				const writes: SyncMessage<TItem>[] = params.transaction.mutations.map(
					(mutation) => ({
						type: "insert" as const,
						value: mutation.modified,
					}),
				);
				bridge.onLocalMutation(writes);
			}
		: undefined;

	const onUpdate = baseOptions.onUpdate
		? async (params: Parameters<NonNullable<TConfig["onUpdate"]>>[0]) => {
				await baseOptions.onUpdate?.(params);
				const writes: SyncMessage<TItem>[] = params.transaction.mutations.map(
					(mutation) => ({
						type: "update" as const,
						value: mutation.modified,
						previousValue: mutation.original,
					}),
				);
				bridge.onLocalMutation(writes);
			}
		: undefined;

	const onDelete = baseOptions.onDelete
		? async (params: Parameters<NonNullable<TConfig["onDelete"]>>[0]) => {
				await baseOptions.onDelete?.(params);
				const writes: SyncMessage<TItem>[] = params.transaction.mutations.map(
					(mutation) => ({
						type: "delete" as const,
						key: mutation.key as string | number,
					}),
				);
				bridge.onLocalMutation(writes);
			}
		: undefined;

	const utils = {
		...baseOptions.utils,
		truncate: async () => {
			await originalTruncate();
			if (forwardTruncateToMutations) {
				bridge.onLocalMutation([{ type: "truncate" } as SyncMessage<TItem>]);
			}
		},
	};

	const options = {
		...baseOptions,
		...(onInsert !== undefined ? { onInsert } : {}),
		...(onUpdate !== undefined ? { onUpdate } : {}),
		...(onDelete !== undefined ? { onDelete } : {}),
		utils,
	} as unknown as TConfig;

	return {
		options,
		bridge,
		setTransportSend: (send) => {
			transportSend = send;
		},
	};
}
