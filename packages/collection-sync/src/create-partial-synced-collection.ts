import type { Collection } from "@tanstack/db";
import { createCollection } from "@tanstack/db";
import {
	withSync,
	type AnyWithSyncableCollectionConfig,
	type InferItemFromCollectionOptions,
	type WithSyncOptions,
} from "./with-sync";

/**
 * Like {@link createSyncedCollection}, but defaults `sendSyncHelloOnConnect` to `false` and
 * `forwardTruncateToMutations` to `false` for use with {@link connectPartialSync} +
 * {@link usePartialSyncWindow} (`mutateBatch` without `syncHello`). Local window resets call
 * `truncate()` on the collection; those must not be sent to the server or they can batch with user
 * edits and wipe authoritative data.
 */
export function createPartialSyncedCollection<
	TConfig extends AnyWithSyncableCollectionConfig,
>(baseOptions: TConfig, syncOptions?: WithSyncOptions) {
	type TItem = InferItemFromCollectionOptions<TConfig>;
	const { options, bridge, setTransportSend } = withSync(baseOptions, {
		...syncOptions,
		sendSyncHelloOnConnect: syncOptions?.sendSyncHelloOnConnect ?? false,
		forwardTruncateToMutations:
			syncOptions?.forwardTruncateToMutations ?? false,
	});
	const collection = createCollection(
		options as never,
	) as unknown as Collection<TItem>;
	bridge.setRowGet((key) => collection.get(key));
	return { collection, bridge, setTransportSend };
}
