import type { Collection } from "@tanstack/db";
import { createCollection } from "@tanstack/db";
import {
	withSync,
	type AnyWithSyncableCollectionConfig,
	type InferItemFromCollectionOptions,
	type WithSyncOptions,
} from "./with-sync";

/**
 * Builds a {@link withSync} wrapper and a TanStack {@link createCollection} in one step.
 * Row type is inferred from the collection config (see {@link InferItemFromCollectionOptions}).
 * (The internal `as unknown as Collection<TItem>` bridges `createCollection`'s overloads to the inferred row type.)
 *
 * Pass `syncOptions` for durable backends (IndexedDB, sqlite-wasm): use `syncStateKey` so incremental
 * reconnect works. Omit `syncOptions` (or omit `syncStateKey`) for in-memory collections that need a
 * full snapshot every load — see the module doc on {@link withSync} / `with-sync.ts`.
 */
export function createSyncedCollection<TConfig extends AnyWithSyncableCollectionConfig>(
	baseOptions: TConfig,
	syncOptions?: WithSyncOptions,
) {
	type TItem = InferItemFromCollectionOptions<TConfig>;
	const { options, bridge, setTransportSend } = withSync(baseOptions, syncOptions);
	const collection = createCollection(options as never) as unknown as Collection<TItem>;
	return { collection, bridge, setTransportSend };
}
