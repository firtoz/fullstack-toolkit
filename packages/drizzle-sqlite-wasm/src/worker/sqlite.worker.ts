import { WorkerHelper } from "@firtoz/worker-helper";
import {
	SqliteWorkerClientMessageSchema,
	SqliteWorkerClientMessageType,
	sqliteWorkerServerMessage,
	SqliteWorkerServerMessageType,
	type SqliteWorkerClientMessage,
	type SqliteWorkerServerMessage,
	type StartRequestId,
	DbIdSchema,
	type DbId,
} from "./schema";
import { handleRemoteCallback } from "../drizzle/handle-callback";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { SqliteWasmWorkerOpenOptions } from "./sqlite-open-options";
import type { Sqlite3Static, Database } from "../types";

// Declare self as DedicatedWorkerGlobalScope for TypeScript
declare var self: DedicatedWorkerGlobalScope;

class SqliteWorkerHelper extends WorkerHelper<
	SqliteWorkerClientMessage,
	SqliteWorkerServerMessage
> {
	private initPromise: Promise<Sqlite3Static>;
	private databases = new Map<
		DbId,
		{
			db: Database;
			initialized: boolean;
		}
	>();

	constructor() {
		super(self, SqliteWorkerClientMessageSchema, sqliteWorkerServerMessage, {
			handleMessage: (data) => {
				this._handleMessage(data);
			},
			handleInputValidationError: (error, originalData) => {
				console.error("Input validation error", { error, originalData });
				throw new Error(`Invalid input: ${error.message}`);
			},
			handleOutputValidationError: (error, originalData) => {
				console.error("Output validation error", { error, originalData });
				throw new Error(`Invalid output: ${error.message}`);
			},
			handleProcessingError: (error, validatedData) => {
				console.error("Processing error", { error, validatedData });
				throw new Error(`Processing error: ${String(error)}`);
			},
		});

		this.initPromise = import("@sqlite.org/sqlite-wasm").then(
			async ({ default: sqlite3InitModule }) => {
				const result = await sqlite3InitModule();

				return result;
			},
		);

		this.send({
			type: SqliteWorkerServerMessageType.Ready,
		});
	}

	private log(...args: unknown[]) {
		console.log(`[${new Date().toISOString()}]`, ...args);
	}

	private error(...args: unknown[]) {
		console.error(`[${new Date().toISOString()}]`, ...args);
	}

	// Helper method to process remote callback requests
	private async processRemoteCallbackRequest(
		data: Extract<
			SqliteWorkerClientMessage,
			{ type: SqliteWorkerClientMessageType.RemoteCallbackRequest }
		>,
		sqliteDb: Database,
	): Promise<void> {
		const result = await handleRemoteCallback({
			sqliteDb,
			sql: data.sql,
			params: data.params,
			method: data.method,
		});

		if (result.success) {
			this.send({
				type: SqliteWorkerServerMessageType.RemoteCallbackResponse,
				id: data.id,
				rows: result.result.rows,
			});
		} else {
			console.error("Error handling remote callback", result.error);
			this.send({
				type: SqliteWorkerServerMessageType.RemoteCallbackError,
				id: data.id,
				error: result.error,
			});
		}
	}

	// Helper method to checkpoint the database (flush WAL to main DB file)
	private async processCheckpointRequest(
		data: Extract<
			SqliteWorkerClientMessage,
			{ type: SqliteWorkerClientMessageType.Checkpoint }
		>,
		sqliteDb: Database,
	): Promise<void> {
		try {
			// Execute PRAGMA wal_checkpoint(TRUNCATE) to ensure all WAL data
			// is written to the main database file and the WAL is truncated.
			// This ensures persistence to OPFS before page reload.
			sqliteDb.exec({
				sql: "PRAGMA wal_checkpoint(TRUNCATE);",
				callback: () => {},
			});

			this.send({
				type: SqliteWorkerServerMessageType.CheckpointComplete,
				id: data.id,
			});
		} catch (e: unknown) {
			const errorMsg = e instanceof Error ? e.message : String(e);
			this.error("Error checkpointing database:", errorMsg);
			this.send({
				type: SqliteWorkerServerMessageType.CheckpointError,
				id: data.id,
				error: errorMsg,
			});
		}
	}

	private applyOpenPragmas(
		db: Database,
		openOptions?: SqliteWasmWorkerOpenOptions,
	) {
		const journalMode = openOptions?.journalMode ?? "WAL";
		const synchronous = openOptions?.synchronous ?? "FULL";
		try {
			db.exec(`PRAGMA journal_mode=${journalMode};`);
			db.exec(`PRAGMA synchronous=${synchronous};`);
			this.log(
				"PRAGMA journal_mode=",
				journalMode,
				"synchronous=",
				synchronous,
			);
		} catch (e) {
			this.error("Error applying open pragmas:", e);
		}
	}

	private async startDatabase(
		sqlite3: Sqlite3Static,
		dbName: string,
		requestId: StartRequestId,
		openOptions?: SqliteWasmWorkerOpenOptions,
	) {
		const dbId = DbIdSchema.parse(crypto.randomUUID());

		const dbFileName = `${dbName}.sqlite3`;
		let db: Database;

		if ("opfs" in sqlite3) {
			db = new sqlite3.oo1.OpfsDb(dbFileName);
			this.log("OPFS database created:", db.filename);
			this.applyOpenPragmas(db, openOptions);
		} else {
			db = new sqlite3.oo1.DB(dbFileName, "c");
			this.log(
				"OPFS is not available, created transient database",
				db.filename,
			);
			this.applyOpenPragmas(db, openOptions);
		}

		// Store database with initialized flag
		this.databases.set(dbId, { db, initialized: true });

		// Send Started message with dbId and requestId
		this.send({
			type: SqliteWorkerServerMessageType.Started,
			requestId,
			dbId,
		});
	}

	private async _handleMessage(data: SqliteWorkerClientMessage) {
		const { type } = data;
		switch (type) {
			case SqliteWorkerClientMessageType.Start:
				{
					const sqlite3 = await this.initPromise;
					await this.startDatabase(
						sqlite3,
						data.dbName,
						data.requestId,
						data.openOptions,
					);
				}
				break;
			case SqliteWorkerClientMessageType.RemoteCallbackRequest:
				{
					// Get the database for this request
					const dbEntry = this.databases.get(data.dbId);
					if (!dbEntry) {
						this.error(`Database not found for dbId: ${data.dbId}`);
						this.send({
							type: SqliteWorkerServerMessageType.RemoteCallbackError,
							id: data.id,
							error: `Database not found: ${data.dbId}`,
						});
						return;
					}

					if (!dbEntry.initialized) {
						this.error(`Database not initialized for dbId: ${data.dbId}`);
						this.send({
							type: SqliteWorkerServerMessageType.RemoteCallbackError,
							id: data.id,
							error: `Database not initialized: ${data.dbId}`,
						});
						return;
					}

					// Process the request with the correct database
					await this.processRemoteCallbackRequest(data, dbEntry.db);
				}
				break;
			case SqliteWorkerClientMessageType.Checkpoint:
				{
					// Get the database for this request
					const dbEntry = this.databases.get(data.dbId);
					if (!dbEntry) {
						this.error(`Database not found for dbId: ${data.dbId}`);
						this.send({
							type: SqliteWorkerServerMessageType.CheckpointError,
							id: data.id,
							error: `Database not found: ${data.dbId}`,
						});
						return;
					}

					if (!dbEntry.initialized) {
						this.error(`Database not initialized for dbId: ${data.dbId}`);
						this.send({
							type: SqliteWorkerServerMessageType.CheckpointError,
							id: data.id,
							error: `Database not initialized: ${data.dbId}`,
						});
						return;
					}

					// Process the checkpoint request
					await this.processCheckpointRequest(data, dbEntry.db);
				}
				break;
			default:
				return exhaustiveGuard(type);
		}
	}
}

new SqliteWorkerHelper();
