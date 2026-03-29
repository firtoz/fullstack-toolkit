export type {
	CollectionUtils,
	ExternalSyncEvent,
	ExternalSyncHandler,
	ReceiveSyncDurableOp,
	SyncMessage,
} from "./sync-types";
export {
	createMemoryCollection,
	memoryCollectionOptions,
	type MemoryCollection,
} from "./memoryCollection";

export { evaluateExpression, getExpressionValue } from "./ir-evaluator";

export {
	USE_DEDUPE,
	createGenericSyncFunction,
	createGenericCollectionConfig,
	type GenericBaseSyncConfig,
	type GenericSyncBackend,
	type GenericSyncFunctionResult,
} from "./generic-sync";
export {
	DeferredWriteQueue,
	type DeferredDeleteMutation,
	type DeferredUpdateMutation,
} from "./deferred-write-queue";
