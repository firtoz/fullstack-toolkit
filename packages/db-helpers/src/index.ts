export type {
	CollectionUtils,
	ExternalSyncEvent,
	ExternalSyncHandler,
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
