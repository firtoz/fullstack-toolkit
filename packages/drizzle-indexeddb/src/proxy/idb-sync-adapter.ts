import type { ExternalSyncHandler } from "@firtoz/drizzle-utils";
import type { IDBProxySyncMessage } from "./idb-proxy-types";

/**
 * Creates a sync message handler that translates proxy sync messages
 * into collection external sync events.
 *
 * @param storeName The store name to handle sync for
 * @param pushExternalSync The collection's external sync handler (from syncResult)
 * @param options Optional configuration
 *
 * @example
 * // Get the sync handler from the collection
 * const { pushExternalSync } = syncResult;
 *
 * // Create the adapter
 * const handleSync = createCollectionSyncHandler(
 *   'todo',
 *   pushExternalSync,
 *   { debug: true }
 * );
 *
 * // Connect to proxy client
 * proxyClient.onSync(handleSync);
 */
export function createCollectionSyncHandler<T = unknown>(
	storeName: string,
	pushExternalSync: ExternalSyncHandler<T>,
	options?: { debug?: boolean },
): (message: IDBProxySyncMessage) => void {
	const debug = options?.debug ?? false;

	return (message: IDBProxySyncMessage) => {
		// Ignore messages for other stores
		if (message.storeName !== storeName) {
			return;
		}

		if (debug) {
			console.log(`[SyncAdapter:${storeName}]`, message.type, message);
		}

		switch (message.type) {
			case "sync:add":
				pushExternalSync({
					type: "insert",
					items: message.items as T[],
				});
				break;

			case "sync:put":
				pushExternalSync({
					type: "update",
					items: message.items as T[],
				});
				break;

			case "sync:delete":
				// For delete, we need the full items, but we only have keys
				// The collection will handle this via the key
				// We'll need to construct minimal items with just the id
				pushExternalSync({
					type: "delete",
					items: message.keys.map((key) => ({ id: key })) as T[],
				});
				break;

			case "sync:truncate":
				pushExternalSync({
					type: "truncate",
				});
				break;
		}
	};
}

/**
 * Combines multiple sync handlers into one.
 * Use when you have multiple stores to sync from the same proxy client.
 *
 * @example
 * const todoHandler = createCollectionSyncHandler('todo', todoSync);
 * const userHandler = createCollectionSyncHandler('user', userSync);
 *
 * proxyClient.onSync(combineSyncHandlers([todoHandler, userHandler]));
 */
export function combineSyncHandlers(
	handlers: Array<(message: IDBProxySyncMessage) => void>,
): (message: IDBProxySyncMessage) => void {
	return (message: IDBProxySyncMessage) => {
		for (const handler of handlers) {
			handler(message);
		}
	};
}
