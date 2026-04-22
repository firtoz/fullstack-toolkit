import { useEffect, useMemo, useRef, useState } from "react";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import {
	customSqliteMigrate,
	type DurableSqliteMigrationConfig,
} from "../migration/migrator";
import {
	drizzleSqliteWasmWorker,
	createInstrumentedDrizzle,
} from "../drizzle/worker";
import type { ISqliteWorkerClient } from "../worker/manager";
import {
	initializeSqliteWorker,
	isSqliteWorkerInitialized,
} from "../worker/global-manager";
import type { SQLInterceptor } from "@firtoz/drizzle-utils";
import type { SqliteWasmWorkerOpenOptions } from "../worker/sqlite-open-options";

/**
 * `useEffect` can run in Node (e.g. unit tests) with no `window`. We only install the no-op
 * DB stub there when a test runner is active — not for arbitrary headless Node usage.
 *
 * Playwright E2E is irrelevant here: the app under test runs in a real browser (`window` exists),
 * so the normal client path is used, not this stub.
 */
function isNodeTestRuntime(): boolean {
	if (typeof window !== "undefined") {
		return false;
	}
	if (typeof process === "undefined" || typeof process.env === "undefined") {
		return false;
	}
	const e = process.env;
	if (e.NODE_ENV === "test") {
		return true;
	}
	// Vitest sets this; avoids relying on NODE_ENV alone
	if (e.VITEST !== undefined) {
		return true;
	}
	return false;
}

/**
 * `connecting` — no worker client yet, or migrations not finished.
 * `ready` — migrations applied, `readyPromise` resolved.
 * `error` — migration (or init) failed; see `sessionError`.
 */
export type DrizzleSqliteSessionStatus = "connecting" | "ready" | "error";

/**
 * Error payload when the hook reports `sessionStatus: "error"`.
 * Add further `| { kind: … }` members later; discriminate on `kind` in UI or logging.
 */
export type DrizzleSqliteSessionError = {
	kind: "migration_failed";
	/** String for display or logs */
	message: string;
	/** The value that was thrown (often an `Error`) */
	original: unknown;
};

/** Normalises `catch` bindings so UI can rely on a stable shape. */
export function toDrizzleSqliteSessionError(
	caught: unknown,
): DrizzleSqliteSessionError {
	const message =
		caught instanceof Error
			? caught.message
			: typeof caught === "string"
				? caught
				: "Database error";
	return { kind: "migration_failed", message, original: caught };
}

type InternalSessionState =
	| { status: "connecting" | "ready"; error: null }
	| { status: "error"; error: DrizzleSqliteSessionError };

export type UseDrizzleSqliteDbResult<TSchema extends Record<string, unknown>> =
	| {
			drizzle: SqliteRemoteDatabase<TSchema>;
			readyPromise: Promise<void>;
			sqliteClient: ISqliteWorkerClient | null;
			sessionStatus: "connecting" | "ready";
			sessionError: null;
	  }
	| {
			drizzle: SqliteRemoteDatabase<TSchema>;
			readyPromise: Promise<void>;
			sqliteClient: ISqliteWorkerClient | null;
			sessionStatus: "error";
			sessionError: DrizzleSqliteSessionError;
	  };

export const useDrizzleSqliteDb = <TSchema extends Record<string, unknown>>(
	WorkerConstructor: new () => Worker,
	dbName: string,
	schema: TSchema,
	migrations: DurableSqliteMigrationConfig,
	debug?: boolean,
	/** Optional interceptor to log ALL SQL queries (including direct Drizzle queries) */
	interceptor?: SQLInterceptor,
	/**
	 * Pragmas applied when the worker first opens this `dbName` in the session.
	 * Ignored if that database was already started (same global worker + dbName).
	 */
	workerOpenOptions?: SqliteWasmWorkerOpenOptions,
): UseDrizzleSqliteDbResult<TSchema> => {
	const resolveRef = useRef<null | (() => void)>(null);
	const rejectRef = useRef<null | ((error: unknown) => void)>(null);
	// "ready" = migrations done and `readyPromise` resolved (or the rare Node `useEffect` stub).
	// Start as "connecting" on every first paint so we do not show "ready" and then go backward
	// to "connecting" when the first client `useEffect` runs.
	const [internalSession, setInternalSession] = useState<InternalSessionState>(
		() => ({ status: "connecting", error: null }),
	);
	const [sqliteClient, setSqliteClient] = useState<ISqliteWorkerClient | null>(
		null,
	);
	const sqliteClientRef = useRef<ISqliteWorkerClient | null>(null);

	/** New promise per logical DB open so a resolved session does not mask the next `dbName`. */
	const readyPromise = useMemo(() => {
		return new Promise<void>((resolve, reject) => {
			resolveRef.current = resolve;
			rejectRef.current = reject;
		});
	}, [dbName]);

	// Initialize the global manager and get db instance
	useEffect(() => {
		if (typeof window === "undefined") {
			if (isNodeTestRuntime()) {
				// e.g. Vitest without jsdom: no worker; unlock `ready` + `readyPromise` for the test tree
				setInternalSession({ status: "ready", error: null });
				setSqliteClient({
					performRemoteCallback: () => {},
					checkpoint: () => Promise.resolve(),
					onStarted: () => {},
					terminate: () => {},
				});
				queueMicrotask(() => {
					resolveRef.current?.();
				});
			}
			return;
		}

		setInternalSession({ status: "connecting", error: null });

		let mounted = true;

		const init = async () => {
			// Initialize manager if not already initialized
			if (!isSqliteWorkerInitialized()) {
				await initializeSqliteWorker(WorkerConstructor);
			}

			// Get manager and create db instance
			const { getSqliteWorkerManager } = await import(
				"../worker/global-manager"
			);
			const manager = getSqliteWorkerManager();
			const instance = await manager.getDbInstance(dbName, workerOpenOptions);

			if (mounted) {
				sqliteClientRef.current = instance;
				setSqliteClient(instance);
			}
		};

		init();

		return () => {
			mounted = false;
		};
	}, [dbName, WorkerConstructor, workerOpenOptions]);

	// Store interceptor in a ref to avoid recreating drizzle on interceptor changes
	const interceptorRef = useRef(interceptor);
	interceptorRef.current = interceptor;

	// Create drizzle instance with a callback-based approach that waits for the client
	// Use instrumented version if interceptor is provided to log ALL queries
	const drizzle = useMemo(() => {
		if (debug) {
			console.log(`[DEBUG] ${dbName} - creating drizzle proxy wrapper`);
		}

		const client: ISqliteWorkerClient = {
			performRemoteCallback: (data, resolve, reject) => {
				const actualClient = sqliteClientRef.current;
				if (!actualClient) {
					console.error(
						`[DEBUG] ${dbName} - performRemoteCallback called but no sqliteClient yet`,
					);
					reject(
						new Error(`Database ${dbName} not ready yet - still initializing`),
					);
					return;
				}
				actualClient.performRemoteCallback(data, resolve, reject);
			},
			onStarted: (callback) => {
				const actualClient = sqliteClientRef.current;
				if (!actualClient) {
					console.warn(
						`[DEBUG] ${dbName} - onStarted called but no sqliteClient yet`,
					);
					return;
				}
				actualClient.onStarted(callback);
			},
			terminate: () => {
				sqliteClientRef.current?.terminate();
			},
			checkpoint: () => {
				return sqliteClientRef.current?.checkpoint() ?? Promise.resolve();
			},
		};

		// Use instrumented version if interceptor is provided
		// Use a wrapper that accesses the ref so interceptor changes don't recreate drizzle
		const interceptorWrapper: SQLInterceptor = {
			onOperation: (op) => interceptorRef.current?.onOperation?.(op),
		};

		// Always use instrumented if initial interceptor was provided
		if (interceptor) {
			return createInstrumentedDrizzle<TSchema>(
				client,
				{ schema },
				interceptorWrapper,
			);
		}

		return drizzleSqliteWasmWorker<TSchema>(client, { schema });
	}, [schema, dbName, !!interceptor]); // Only recreate if interceptor presence changes, not on every render

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		if (!sqliteClient) {
			if (debug) {
				console.log(`[DEBUG] ${dbName} - waiting for sqliteClient...`);
			}
			return;
		}

		sqliteClient.onStarted(async () => {
			if (typeof window === "undefined") {
				return;
			}
			try {
				setInternalSession({ status: "connecting", error: null });
				await customSqliteMigrate(drizzle, migrations);
				resolveRef.current?.();
				setInternalSession({ status: "ready", error: null });
			} catch (caught) {
				console.error(`Migration error for ${dbName}:`, caught);
				const err = toDrizzleSqliteSessionError(caught);
				setInternalSession({ status: "error", error: err });
				rejectRef.current?.(caught);
			}
		});

		return () => {
			sqliteClient.terminate();
		};
	}, [sqliteClient, drizzle, migrations, dbName, debug]);

	if (internalSession.status === "error") {
		return {
			drizzle,
			readyPromise,
			sqliteClient,
			sessionStatus: "error" as const,
			sessionError: internalSession.error,
		};
	}
	return {
		drizzle,
		readyPromise,
		sqliteClient,
		sessionStatus: internalSession.status,
		sessionError: null,
	};
};
