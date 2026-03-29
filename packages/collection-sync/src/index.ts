export {
	DEFAULT_SYNC_COLLECTION_ID,
	createClientMessageSchema,
	createServerMessageSchema,
	clientMessageSchema,
	serverMessageSchema,
	mutationIntentSchema,
	syncRangeSchema,
	toSyncMessage,
	createClientMutationId,
	type MutationIntent,
	type IndexRangeCursor,
	type IndexRangeOffset,
	type PredicateRange,
	type RangeCondition,
	type RangeConditionOp,
	type RangeFingerprint,
	type SyncBackfillMode,
	type SyncClientMessage,
	type SyncClientMessageBody,
	type SyncRange,
	type SyncRangeSort,
	type SyncServerMessage,
	type SyncServerMessageBody,
	type SyncSortDirection,
} from "./sync-protocol";

export {
	SyncClientBridge,
	type SyncClientBridgeOptions,
} from "./sync-client-bridge";

export {
	PartialSyncClientBridge,
	type PartialSyncClientBridgeOptions,
	type PartialSyncRangePatchAppliedEvent,
	type PartialSyncRangeResult,
	type PartialSyncReconcileResult,
	type PartialSyncState,
	type PartialSyncViewTransitionEvent,
} from "./partial-sync-client-bridge";

export {
	CacheManager,
	type CacheEntry,
	type CacheManagerOptions,
	type CacheStorageEstimate,
	type CacheViewport,
} from "./cache-manager";

export {
	SyncServerBridge,
	type SyncServerBridgeStore,
	type SyncServerBridgeOptions,
} from "./sync-server-bridge";

export {
	PartialSyncServerBridge,
	type ClientQueryState,
	type DeliveredRange,
	type PartialSyncPushServerChangesOptions,
	type PartialSyncServerBridgeOptions,
	type PartialSyncServerBridgeStore,
} from "./partial-sync-server-bridge";

export {
	PartialSyncMutationHandler,
	type PartialSyncMutationHandlerOptions,
	type PartialSyncMutationHandlerStore,
} from "./partial-sync-mutation-handler";

export {
	withSync,
	getBrowserLocalStorageSyncStateStorage,
	type AnyWithSyncableCollectionConfig,
	type InferItemFromCollectionOptions,
	type SyncStateStorage,
	type SyncableCollectionItem,
	type WithSyncOptions,
	type WithSyncableCollectionConfig,
} from "./with-sync";

export { createSyncedCollection } from "./create-synced-collection";

export { createPartialSyncedCollection } from "./create-partial-synced-collection";

export {
	connectSync,
	type ConnectSyncOptions,
	type ConnectSyncTransport,
} from "./connect-sync";

export {
	connectPartialSync,
	type ConnectPartialSyncOptions,
	type ConnectPartialSyncTransport,
} from "./connect-partial-sync";

export {
	partialSyncRowKey,
	partialSyncRowVersionWatermarkMs,
	partialSyncRowVersionWatermarkMsUnknown,
	type PartialSyncRowId,
	type PartialSyncRowRef,
	type PartialSyncRowShape,
	type PartialSyncRowVersion,
} from "./partial-sync-row-key";

export type {
	PartialSyncPatchResult,
	PartialSyncViewTransition,
} from "./partial-sync-interest";

export {
	compareInterestValues,
	filterSyncMessagesForPredicateRange,
	rowMatchesClientInterest,
	type ClassifyPartialSyncRangePatchOptions,
} from "./partial-sync-interest";
