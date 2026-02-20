/**
 * Generic collection sync types. Used by memory, IndexedDB, SQLite, and other
 * collection backends for a unified sync protocol.
 */

/**
 * Canonical per-mutation sync message. Use for broadcast and receive across all collection types.
 */
export type SyncMessage<
	T = unknown,
	TKey extends string | number = string | number,
> =
	| { type: "insert"; value: T }
	| { type: "update"; value: T; previousValue: T }
	| { type: "delete"; key: TKey }
	| { type: "truncate" };

/**
 * External sync event (batched). Used internally by the sync layer.
 */
export type ExternalSyncEvent<T> =
	| { type: "insert"; items: T[] }
	| { type: "update"; items: T[] }
	| { type: "delete"; items: T[] }
	| { type: "truncate" };

/**
 * Handler for external sync events (internal use).
 */
export type ExternalSyncHandler<T> = (event: ExternalSyncEvent<T>) => void;

/**
 * Collection utils: truncate and receiveSync (canonical sync protocol).
 */
export interface CollectionUtils<T = unknown> {
	/**
	 * Clear all data from the store (truncate).
	 * This clears the backend store and updates the local reactive store.
	 */
	truncate: () => Promise<void>;
	/**
	 * Apply incoming sync messages without triggering mutation handlers.
	 * Use the same SyncMessage[] shape for memory and backend collections.
	 */
	receiveSync: (messages: SyncMessage<T>[]) => Promise<void>;
}
