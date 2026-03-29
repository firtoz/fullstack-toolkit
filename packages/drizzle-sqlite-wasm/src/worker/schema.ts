import z from "zod";
import { SqliteWasmWorkerOpenOptionsSchema } from "./sqlite-open-options";

export const RemoteCallbackIdSchema = z.string().brand("remote-callback-id");
export type RemoteCallbackId = z.infer<typeof RemoteCallbackIdSchema>;

export const DbIdSchema = z.string().brand("db-id");
export type DbId = z.infer<typeof DbIdSchema>;

export const StartRequestIdSchema = z.string().brand("start-request-id");
export type StartRequestId = z.infer<typeof StartRequestIdSchema>;

export const CheckpointIdSchema = z.string().brand("checkpoint-id");
export type CheckpointId = z.infer<typeof CheckpointIdSchema>;

export enum SqliteWorkerClientMessageType {
	Start = "start",
	RemoteCallbackRequest = "remote-callback-request",
	Checkpoint = "checkpoint",
}

export enum SqliteWorkerServerMessageType {
	Ready = "ready",
	Started = "started",
	RemoteCallbackResponse = "remote-callback-response",
	RemoteCallbackError = "remote-callback-error",
	CheckpointComplete = "checkpoint-complete",
	CheckpointError = "checkpoint-error",
}

export const RemoteCallbackRequestSchema = z.object({
	type: z.literal(SqliteWorkerClientMessageType.RemoteCallbackRequest),
	// AsyncRemoteCallback
	// sql: string, params: any[], method: 'run' | 'all' | 'values' | 'get'
	id: RemoteCallbackIdSchema,
	dbId: DbIdSchema,
	sql: z.string(),
	params: z.array(z.any()),
	method: z.enum(["run", "all", "values", "get"]),
});

export type SqliteWorkerRemoteCallbackClientMessage = z.infer<
	typeof RemoteCallbackRequestSchema
>;

export const CheckpointRequestSchema = z.object({
	type: z.literal(SqliteWorkerClientMessageType.Checkpoint),
	id: CheckpointIdSchema,
	dbId: DbIdSchema,
});

export type CheckpointRequest = z.infer<typeof CheckpointRequestSchema>;

export const SqliteWorkerClientMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(SqliteWorkerClientMessageType.Start),
		requestId: StartRequestIdSchema,
		dbName: z.string(),
		/** Applied on first open of this `dbName` in the worker process. */
		openOptions: SqliteWasmWorkerOpenOptionsSchema.optional(),
	}),
	RemoteCallbackRequestSchema,
	CheckpointRequestSchema,
]);

export const RemoteCallbackResponseSchema = z.object({
	type: z.literal(SqliteWorkerServerMessageType.RemoteCallbackResponse),
	id: RemoteCallbackIdSchema,
	rows: z.array(z.any()),
});

export const RemoteCallbackErrorServerMessageSchema = z.object({
	type: z.literal(SqliteWorkerServerMessageType.RemoteCallbackError),
	id: RemoteCallbackIdSchema,
	error: z.string(),
});

export const CheckpointCompleteSchema = z.object({
	type: z.literal(SqliteWorkerServerMessageType.CheckpointComplete),
	id: CheckpointIdSchema,
});

export const CheckpointErrorSchema = z.object({
	type: z.literal(SqliteWorkerServerMessageType.CheckpointError),
	id: CheckpointIdSchema,
	error: z.string(),
});

export const sqliteWorkerServerMessage = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(SqliteWorkerServerMessageType.Ready),
	}),
	z.object({
		type: z.literal(SqliteWorkerServerMessageType.Started),
		requestId: StartRequestIdSchema,
		dbId: DbIdSchema,
	}),
	RemoteCallbackResponseSchema,
	RemoteCallbackErrorServerMessageSchema,
	CheckpointCompleteSchema,
	CheckpointErrorSchema,
]);

export type SqliteWorkerClientMessage = z.infer<
	typeof SqliteWorkerClientMessageSchema
>;

export type SqliteWorkerServerMessage = z.infer<
	typeof sqliteWorkerServerMessage
>;

export type SqliteClientRemoteCallbackServerMessage = z.infer<
	typeof RemoteCallbackResponseSchema
>;
