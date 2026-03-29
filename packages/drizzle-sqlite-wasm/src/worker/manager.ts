import { exhaustiveGuard } from "@firtoz/maybe-error";
import { WorkerClient } from "@firtoz/worker-helper/WorkerClient";
import type { SqliteWasmWorkerOpenOptions } from "./sqlite-open-options";
import {
	type SqliteWorkerClientMessage,
	type SqliteWorkerServerMessage,
	type RemoteCallbackId,
	type DbId,
	type StartRequestId,
	type CheckpointId,
	SqliteWorkerClientMessageSchema,
	sqliteWorkerServerMessage,
	SqliteWorkerServerMessageType,
	SqliteWorkerClientMessageType,
	type SqliteWorkerRemoteCallbackClientMessage,
	RemoteCallbackIdSchema,
	StartRequestIdSchema,
	CheckpointIdSchema,
} from "./schema";

export interface ISqliteWorkerClient {
	performRemoteCallback: (
		data: Omit<SqliteWorkerRemoteCallbackClientMessage, "type" | "id" | "dbId">,
		resolve: (value: { rows: unknown[] }) => void,
		reject: (error: Error) => void,
	) => void;
	checkpoint: () => Promise<void>;
	onStarted: (callback: () => void) => void;
	terminate: () => void;
}

/**
 * Per-database instance that can perform operations on a specific database
 */
export class DbInstance implements ISqliteWorkerClient {
	private dbId: DbId | null = null;
	private startedCallbacks: Array<() => void> = [];
	private isStarted = false;

	constructor(
		private readonly manager: SqliteWorkerManager,
		public readonly dbName: string,
		private readonly debug: boolean = false,
	) {}

	/**
	 * Internal method called by manager when database is started
	 */
	_setStarted(dbId: DbId) {
		this.dbId = dbId;
		this.isStarted = true;

		// Call all pending callbacks
		for (const callback of this.startedCallbacks) {
			callback();
		}
		this.startedCallbacks = [];
	}

	public performRemoteCallback(
		data: Omit<SqliteWorkerRemoteCallbackClientMessage, "type" | "id" | "dbId">,
		resolve: (value: { rows: unknown[] }) => void,
		reject: (error: Error) => void,
	) {
		if (!this.dbId) {
			reject(
				new Error(`Database not started - dbId is null for ${this.dbName}`),
			);
			return;
		}

		if (this.debug) {
			console.log(
				`[${new Date().toISOString()}] [DbInstance:${this.dbName}] performing remote callback`,
				data,
			);
		}

		this.manager.performRemoteCallback(this.dbId, data, resolve, reject);
	}

	public checkpoint(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.dbId) {
				reject(
					new Error(`Database not started - dbId is null for ${this.dbName}`),
				);
				return;
			}

			if (this.debug) {
				console.log(
					`[${new Date().toISOString()}] [DbInstance:${this.dbName}] checkpointing database`,
				);
			}

			this.manager.checkpoint(this.dbId, resolve, reject);
		});
	}

	public onStarted(callback: () => void) {
		if (this.isStarted) {
			// Already started, call immediately
			callback();
		} else {
			this.startedCallbacks.push(callback);
		}
	}

	public terminate() {
		// Per-db instances don't terminate the worker
		// That's managed by the SqliteWorkerManager
	}
}

/**
 * Main worker manager that can create multiple database instances
 */
export class SqliteWorkerManager extends WorkerClient<
	SqliteWorkerClientMessage,
	SqliteWorkerServerMessage
> {
	private readonly remoteCallbacks = new Map<
		RemoteCallbackId,
		{
			resolve: (value: { rows: unknown[] }) => void;
			reject: (error: Error) => void;
		}
	>();

	private readonly checkpointCallbacks = new Map<
		CheckpointId,
		{
			resolve: () => void;
			reject: (error: Error) => void;
		}
	>();

	private readyResolve?: () => void;
	private readyReject?: (error: Error) => void;
	private readonly readyPromise: Promise<void>;
	private isReady = false;

	private readonly dbInstances = new Map<string, DbInstance>();
	private readonly pendingStarts = new Map<
		StartRequestId,
		{ dbName: string; instance: DbInstance }
	>();

	constructor(
		worker: Worker,
		private readonly debug: boolean = false,
	) {
		super({
			worker,
			clientSchema: SqliteWorkerClientMessageSchema,
			serverSchema: sqliteWorkerServerMessage,
			onMessage: (message) => {
				this.onMessage(message);
			},
			onValidationError: (error, rawMessage) => {
				console.error(error, rawMessage);
				// Reject promises if we get validation errors before being ready
				if (!this.isReady && this.readyReject) {
					this.readyReject(new Error(`Validation error: ${error.message}`));
				}
			},
			onError: (event) => {
				console.error(event);
				// Reject promises if worker errors before being ready
				if (!this.isReady && this.readyReject) {
					this.readyReject(
						new Error(`Worker error: ${event.message || "Unknown error"}`),
					);
				}
			},
		});

		this.readyPromise = new Promise((resolve, reject) => {
			this.readyResolve = resolve;
			this.readyReject = reject;
		});
	}

	/**
	 * Promise that resolves when the worker sends its first Ready message
	 */
	public get ready(): Promise<void> {
		return this.readyPromise;
	}

	private onMessage(message: SqliteWorkerServerMessage) {
		const { type } = message;
		switch (type) {
			case SqliteWorkerServerMessageType.Ready:
				{
					this.isReady = true;
					this.readyResolve?.();
					if (this.debug) {
						console.log("[SqliteWorkerManager] ready for databases");
					}
				}
				break;
			case SqliteWorkerServerMessageType.Started:
				{
					const pending = this.pendingStarts.get(message.requestId);
					if (pending) {
						pending.instance._setStarted(message.dbId);
						this.pendingStarts.delete(message.requestId);
					}
				}
				break;
			case SqliteWorkerServerMessageType.RemoteCallbackResponse:
				{
					const { id, rows } = message;
					const remoteCallback = this.remoteCallbacks.get(id);
					if (remoteCallback) {
						remoteCallback.resolve({ rows });
						this.remoteCallbacks.delete(id);
					}
				}
				break;
			case SqliteWorkerServerMessageType.RemoteCallbackError:
				{
					const { id, error } = message;
					const remoteCallback = this.remoteCallbacks.get(id);
					if (remoteCallback) {
						remoteCallback.reject(new Error(error));
						this.remoteCallbacks.delete(id);
					}
				}
				break;
			case SqliteWorkerServerMessageType.CheckpointComplete:
				{
					const { id } = message;
					const checkpointCallback = this.checkpointCallbacks.get(id);
					if (checkpointCallback) {
						checkpointCallback.resolve();
						this.checkpointCallbacks.delete(id);
					}
				}
				break;
			case SqliteWorkerServerMessageType.CheckpointError:
				{
					const { id, error } = message;
					const checkpointCallback = this.checkpointCallbacks.get(id);
					if (checkpointCallback) {
						checkpointCallback.reject(new Error(error));
						this.checkpointCallbacks.delete(id);
					}
				}
				break;
			default:
				return exhaustiveGuard(type);
		}
	}

	/**
	 * Get or create a database instance
	 */
	public async getDbInstance(
		dbName: string,
		openOptions?: SqliteWasmWorkerOpenOptions,
	): Promise<DbInstance> {
		// Check if instance already exists
		let instance = this.dbInstances.get(dbName);
		if (instance) {
			return instance;
		}

		// Check again after waiting (another call might have created it)
		instance = this.dbInstances.get(dbName);
		if (instance) {
			return instance;
		}

		// Create new instance
		instance = new DbInstance(this, dbName, this.debug);
		this.dbInstances.set(dbName, instance);

		// Start the database

		const startRequestId = StartRequestIdSchema.parse(crypto.randomUUID());
		this.pendingStarts.set(startRequestId, { dbName, instance });

		this.send({
			type: SqliteWorkerClientMessageType.Start,
			requestId: startRequestId,
			dbName: dbName,
			...(openOptions !== undefined ? { openOptions } : {}),
		});

		return instance;
	}

	/**
	 * Internal method for db instances to perform remote callbacks
	 */
	public performRemoteCallback(
		dbId: DbId,
		data: Omit<SqliteWorkerRemoteCallbackClientMessage, "type" | "id" | "dbId">,
		resolve: (value: { rows: unknown[] }) => void,
		reject: (error: Error) => void,
	) {
		if (this.debug) {
			console.log(
				`[${new Date().toISOString()}] [SqliteWorkerManager] performing remote callback for dbId: ${dbId}`,
				data,
			);
		}
		const id = RemoteCallbackIdSchema.parse(crypto.randomUUID());
		this.remoteCallbacks.set(id, { resolve, reject });
		this.send({
			type: SqliteWorkerClientMessageType.RemoteCallbackRequest,
			id,
			dbId,
			sql: data.sql,
			params: data.params,
			method: data.method,
		});
	}

	/**
	 * Internal method for db instances to checkpoint the database
	 */
	public checkpoint(
		dbId: DbId,
		resolve: () => void,
		reject: (error: Error) => void,
	) {
		if (this.debug) {
			console.log(
				`[${new Date().toISOString()}] [SqliteWorkerManager] checkpointing database for dbId: ${dbId}`,
			);
		}
		const id = CheckpointIdSchema.parse(crypto.randomUUID());
		this.checkpointCallbacks.set(id, { resolve, reject });
		this.send({
			type: SqliteWorkerClientMessageType.Checkpoint,
			id,
			dbId,
		});
	}
}
