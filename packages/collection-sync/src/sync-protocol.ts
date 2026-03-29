import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import { z } from "zod";

/** Default {@link SyncClientMessage} / {@link SyncServerMessage} `collectionId` when omitted on the wire. */
export const DEFAULT_SYNC_COLLECTION_ID = "default" as const;

const collectionIdSchema = z
	.string()
	.min(1)
	.default(DEFAULT_SYNC_COLLECTION_ID);

const mutationTypeSchema = z.enum(["insert", "update", "delete", "truncate"]);

export const mutationIntentSchema = z.object({
	clientMutationId: z.string().min(1),
	type: mutationTypeSchema,
	value: z.record(z.string(), z.unknown()).optional(),
	previousValue: z.record(z.string(), z.unknown()).optional(),
	key: z.union([z.string(), z.number()]).optional(),
});

export type MutationIntent = z.infer<typeof mutationIntentSchema>;

export type SyncSortDirection = "asc" | "desc";
export type SyncRangeSort = {
	column: string;
	direction: SyncSortDirection;
};

/** Fixed operator set for predicate-based range queries (e.g. spatial filters). */
export type RangeConditionOp =
	| "gt"
	| "gte"
	| "lt"
	| "lte"
	| "eq"
	| "neq"
	| "between";

export type RangeCondition = {
	column: string;
	op: RangeConditionOp;
	value: unknown;
	/** Required when `op` is `"between"`. */
	valueTo?: unknown;
};

export type IndexRangeCursor = {
	kind: "index";
	mode: "cursor";
	sort: SyncRangeSort;
	limit: number;
	afterCursor: unknown | null;
};

export type IndexRangeOffset = {
	kind: "index";
	mode: "offset";
	sort: SyncRangeSort;
	limit: number;
	offset: number;
};

export type PredicateRange = {
	kind: "predicate";
	conditions: RangeCondition[];
	sort?: SyncRangeSort;
	limit?: number;
};

export type SyncRange = IndexRangeCursor | IndexRangeOffset | PredicateRange;

/** Client watermark for reconciliation (max row version in range + count). */
export type RangeFingerprint = {
	version: number;
	count: number;
};

const syncRangeSortSchema = z.object({
	column: z.string().min(1),
	direction: z.enum(["asc", "desc"]),
});

const rangeConditionOpSchema = z.enum([
	"gt",
	"gte",
	"lt",
	"lte",
	"eq",
	"neq",
	"between",
]);

const rangeConditionSchema = z.object({
	column: z.string().min(1),
	op: rangeConditionOpSchema,
	value: z.unknown(),
	valueTo: z.unknown().optional(),
});

const indexRangeCursorSchema = z.object({
	kind: z.literal("index"),
	mode: z.literal("cursor"),
	sort: syncRangeSortSchema,
	limit: z.number().int().positive(),
	afterCursor: z.unknown().nullable(),
});

const indexRangeOffsetSchema = z.object({
	kind: z.literal("index"),
	mode: z.literal("offset"),
	sort: syncRangeSortSchema,
	limit: z.number().int().positive(),
	offset: z.number().int().nonnegative(),
});

const predicateRangeSchema = z.object({
	kind: z.literal("predicate"),
	conditions: z.array(rangeConditionSchema).min(1),
	sort: syncRangeSortSchema.optional(),
	limit: z.number().int().positive().optional(),
});

export const syncRangeSchema: z.ZodType<SyncRange> = z.union([
	indexRangeCursorSchema,
	indexRangeOffsetSchema,
	predicateRangeSchema,
]);

const rangeFingerprintSchema = z.object({
	version: z.number().int().nonnegative(),
	count: z.number().int().nonnegative(),
});

export function createClientMessageSchema() {
	return z.discriminatedUnion("type", [
		z.object({
			type: z.literal("mutateBatch"),
			collectionId: collectionIdSchema,
			clientId: z.string().min(1),
			mutations: z.array(mutationIntentSchema).min(1),
		}),
		z.object({
			type: z.literal("syncHello"),
			collectionId: collectionIdSchema,
			clientId: z.string().min(1),
			lastAckedServerVersion: z.number().int().nonnegative(),
		}),
		z.object({
			type: z.literal("ping"),
			collectionId: collectionIdSchema,
			clientId: z.string().min(1),
			timestamp: z.number(),
		}),
		z.object({
			type: z.literal("queryRange"),
			collectionId: collectionIdSchema,
			clientId: z.string().min(1),
			requestId: z.string().min(1),
			sort: z.object({
				column: z.string().min(1),
				direction: z.enum(["asc", "desc"]),
			}),
			limit: z.number().int().positive(),
			afterCursor: z.unknown().nullable(),
		}),
		z.object({
			type: z.literal("queryByOffset"),
			collectionId: collectionIdSchema,
			clientId: z.string().min(1),
			requestId: z.string().min(1),
			sort: z.object({
				column: z.string().min(1),
				direction: z.enum(["asc", "desc"]),
			}),
			limit: z.number().int().positive(),
			offset: z.number().int().nonnegative(),
		}),
		z.object({
			type: z.literal("rangeQuery"),
			collectionId: collectionIdSchema,
			clientId: z.string().min(1),
			requestId: z.string().min(1),
			range: syncRangeSchema,
			fingerprint: rangeFingerprintSchema.optional(),
		}),
		z.object({
			type: z.literal("rangeReconcile"),
			collectionId: collectionIdSchema,
			clientId: z.string().min(1),
			requestId: z.string().min(1),
			range: syncRangeSchema,
			manifest: z.array(
				z.object({
					id: z.union([z.string(), z.number()]),
					version: z.number().int().nonnegative(),
				}),
			),
		}),
	]);
}

export type SyncClientMessage = z.infer<
	ReturnType<typeof createClientMessageSchema>
>;

export const clientMessageSchema = createClientMessageSchema();

/** How to apply {@link SyncServerMessage} `syncBackfill` changes on the client. */
export type SyncBackfillMode = "snapshot" | "delta";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
	? Omit<T, K>
	: never;

/** Client payload before `collectionId` is attached (bridge outbox helpers). */
export type SyncClientMessageBody = DistributiveOmit<
	SyncClientMessage,
	"collectionId"
>;

export function createServerMessageSchema<
	TItem = unknown,
	TKey extends string | number = string | number,
>() {
	const syncMessageSchema = z.custom<SyncMessage<TItem, TKey>>();
	return z.discriminatedUnion("type", [
		z.object({
			type: z.literal("ack"),
			collectionId: collectionIdSchema,
			clientId: z.string().min(1),
			clientMutationIds: z.array(z.string().min(1)),
			serverVersion: z.number().int().nonnegative(),
			changes: z.array(syncMessageSchema),
		}),
		z.object({
			type: z.literal("syncBatch"),
			collectionId: collectionIdSchema,
			serverVersion: z.number().int().nonnegative(),
			changes: z.array(syncMessageSchema),
		}),
		z.object({
			type: z.literal("syncBackfill"),
			collectionId: collectionIdSchema,
			mode: z.enum(["snapshot", "delta"]),
			serverVersion: z.number().int().nonnegative(),
			changes: z.array(syncMessageSchema),
			chunkIndex: z.number().int().nonnegative().optional(),
			totalChunks: z.number().int().positive().optional(),
		}),
		z.object({
			type: z.literal("reject"),
			collectionId: collectionIdSchema,
			clientId: z.string().min(1),
			clientMutationId: z.string().min(1),
			reason: z.string().min(1),
			correctiveChanges: z.array(syncMessageSchema).default([]),
		}),
		z.object({
			type: z.literal("pong"),
			collectionId: collectionIdSchema,
			timestamp: z.number(),
		}),
		z.object({
			type: z.literal("queryRangeChunk"),
			collectionId: collectionIdSchema,
			requestId: z.string().min(1),
			rows: z.array(z.custom<TItem>()),
			totalCount: z.number().int().nonnegative(),
			lastCursor: z.unknown().nullable(),
			hasMore: z.boolean(),
			chunkIndex: z.number().int().nonnegative(),
			done: z.boolean(),
		}),
		z.object({
			type: z.literal("rangePatch"),
			collectionId: collectionIdSchema,
			change: syncMessageSchema,
			viewTransition: z.enum(["enterView", "exitView"]).optional(),
		}),
		z.object({
			type: z.literal("rangeUpToDate"),
			collectionId: collectionIdSchema,
			requestId: z.string().min(1),
			totalCount: z.number().int().nonnegative(),
		}),
		z.object({
			type: z.literal("rangeDelta"),
			collectionId: collectionIdSchema,
			requestId: z.string().min(1),
			totalCount: z.number().int().nonnegative(),
			changes: z.array(syncMessageSchema),
			lastCursor: z.unknown().optional(),
		}),
		z.object({
			type: z.literal("rangeReconcileResult"),
			collectionId: collectionIdSchema,
			requestId: z.string().min(1),
			added: z.array(syncMessageSchema),
			updated: z.array(syncMessageSchema),
			stale: z.array(z.union([z.string(), z.number()])),
			movedHints: z.array(
				z.object({
					id: z.union([z.string(), z.number()]),
					hint: z.record(z.string(), z.unknown()),
				}),
			),
			totalCount: z.number().int().nonnegative(),
		}),
	]);
}

export type SyncServerMessage<
	TItem = unknown,
	TKey extends string | number = string | number,
> = z.infer<ReturnType<typeof createServerMessageSchema<TItem, TKey>>>;

/** Server payload before `collectionId` is attached (bridge outbox helpers). */
export type SyncServerMessageBody<
	TItem = unknown,
	TKey extends string | number = string | number,
> = DistributiveOmit<SyncServerMessage<TItem, TKey>, "collectionId">;

/** Attach `collectionId` to an outbound server message (single-collection servers). */
export function withServerCollectionId<TItem, TKey extends string | number>(
	collectionId: string,
	message: SyncServerMessage<TItem, TKey>,
): SyncServerMessage<TItem, TKey> {
	return { ...message, collectionId };
}

export const serverMessageSchema = createServerMessageSchema();

export function toSyncMessage(intent: MutationIntent): SyncMessage {
	switch (intent.type) {
		case "insert":
			if (!intent.value) throw new Error("Insert intent requires value");
			return { type: "insert", value: intent.value };
		case "update":
			if (!intent.value || !intent.previousValue) {
				throw new Error("Update intent requires value and previousValue");
			}
			return {
				type: "update",
				value: intent.value,
				previousValue: intent.previousValue,
			};
		case "delete":
			if (intent.key === undefined)
				throw new Error("Delete intent requires key");
			return { type: "delete", key: intent.key };
		case "truncate":
			return { type: "truncate" };
		default:
			exhaustiveGuard(intent.type);
	}
}

export function createClientMutationId(prefix = "m"): string {
	return `${prefix}_${crypto.randomUUID()}`;
}
