import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import { z } from "zod";

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

export type SyncClientMessage =
	| {
			type: "mutateBatch";
			clientId: string;
			mutations: MutationIntent[];
	  }
	| {
			type: "syncHello";
			clientId: string;
			lastAckedServerVersion: number;
	  }
	| {
			type: "ping";
			clientId: string;
			timestamp: number;
	  }
	| {
			type: "queryRange";
			clientId: string;
			requestId: string;
			sort: SyncRangeSort;
			limit: number;
			afterCursor: unknown | null;
	  }
	| {
			type: "queryByOffset";
			clientId: string;
			requestId: string;
			sort: SyncRangeSort;
			limit: number;
			offset: number;
	  };

export function createClientMessageSchema(): z.ZodType<SyncClientMessage> {
	return z.discriminatedUnion("type", [
		z.object({
			type: z.literal("mutateBatch"),
			clientId: z.string().min(1),
			mutations: z.array(mutationIntentSchema).min(1),
		}),
		z.object({
			type: z.literal("syncHello"),
			clientId: z.string().min(1),
			lastAckedServerVersion: z.number().int().nonnegative(),
		}),
		z.object({
			type: z.literal("ping"),
			clientId: z.string().min(1),
			timestamp: z.number(),
		}),
		z.object({
			type: z.literal("queryRange"),
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
			clientId: z.string().min(1),
			requestId: z.string().min(1),
			sort: z.object({
				column: z.string().min(1),
				direction: z.enum(["asc", "desc"]),
			}),
			limit: z.number().int().positive(),
			offset: z.number().int().nonnegative(),
		}),
	]);
}

export const clientMessageSchema = createClientMessageSchema();

/** How to apply {@link SyncServerMessage} `syncBackfill` changes on the client. */
export type SyncBackfillMode = "snapshot" | "delta";

export type SyncServerMessage<
	TItem = unknown,
	TKey extends string | number = string | number,
> =
	| {
			type: "ack";
			clientId: string;
			clientMutationIds: string[];
			serverVersion: number;
			changes: SyncMessage<TItem, TKey>[];
	  }
	| {
			type: "syncBatch";
			serverVersion: number;
			changes: SyncMessage<TItem, TKey>[];
	  }
	| {
			type: "syncBackfill";
			/** `snapshot`: replace local collection state, then apply `changes`. `delta`: apply incrementally only. */
			mode: SyncBackfillMode;
			serverVersion: number;
			changes: SyncMessage<TItem, TKey>[];
			chunkIndex?: number;
			totalChunks?: number;
	  }
	| {
			type: "reject";
			clientId: string;
			clientMutationId: string;
			reason: string;
			correctiveChanges: SyncMessage<TItem, TKey>[];
	  }
	| {
			type: "pong";
			timestamp: number;
	  }
	| {
			type: "queryRangeChunk";
			requestId: string;
			rows: TItem[];
			totalCount: number;
			lastCursor: unknown | null;
			hasMore: boolean;
			chunkIndex: number;
			done: boolean;
	  }
	| {
			type: "rangePatch";
			change: SyncMessage<TItem, TKey>;
	  };

export function createServerMessageSchema<
	TItem = unknown,
	TKey extends string | number = string | number,
>(): z.ZodType<SyncServerMessage<TItem, TKey>> {
	const syncMessageSchema = z.custom<SyncMessage<TItem, TKey>>();
	return z.discriminatedUnion("type", [
		z.object({
			type: z.literal("ack"),
			clientId: z.string().min(1),
			clientMutationIds: z.array(z.string().min(1)),
			serverVersion: z.number().int().nonnegative(),
			changes: z.array(syncMessageSchema),
		}),
		z.object({
			type: z.literal("syncBatch"),
			serverVersion: z.number().int().nonnegative(),
			changes: z.array(syncMessageSchema),
		}),
		z.object({
			type: z.literal("syncBackfill"),
			mode: z.enum(["snapshot", "delta"]),
			serverVersion: z.number().int().nonnegative(),
			changes: z.array(syncMessageSchema),
			chunkIndex: z.number().int().nonnegative().optional(),
			totalChunks: z.number().int().positive().optional(),
		}),
		z.object({
			type: z.literal("reject"),
			clientId: z.string().min(1),
			clientMutationId: z.string().min(1),
			reason: z.string().min(1),
			correctiveChanges: z.array(syncMessageSchema).default([]),
		}),
		z.object({
			type: z.literal("pong"),
			timestamp: z.number(),
		}),
		z.object({
			type: z.literal("queryRangeChunk"),
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
			change: syncMessageSchema,
		}),
	]);
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
