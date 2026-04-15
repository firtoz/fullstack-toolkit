import { useEffect, useMemo, useRef, useState } from "react";
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
import type { SQLInterceptor } from "../collections/sqlite-collection";
import type { SqliteWasmWorkerOpenOptions } from "../worker/sqlite-open-options";

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
) => {
	const resolveRef = useRef<null | (() => void)>(null);
	const rejectRef = useRef<null | ((error: unknown) => void)>(null);
	const [sqliteClient, setSqliteClient] = useState<ISqliteWorkerClient | null>(
		null,
	);
	const sqliteClientRef = useRef<ISqliteWorkerClient | null>(null);

	const readyPromise = useMemo(() => {
		return new Promise<void>((resolve, reject) => {
			resolveRef.current = resolve;
			rejectRef.current = reject;
		});
	}, []);

	// Initialize the global manager and get db instance
	useEffect(() => {
		if (typeof window === "undefined") {
			// SSR stub
			setSqliteClient({
				performRemoteCallback: () => {},
				checkpoint: () => Promise.resolve(),
				onStarted: () => {},
				terminate: () => {},
			});
			return;
		}

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
		if (!sqliteClient) {
			if (debug) {
				console.log(`[DEBUG] ${dbName} - waiting for sqliteClient...`);
			}
			return;
		}

		sqliteClient.onStarted(async () => {
			try {
				await customSqliteMigrate(drizzle, migrations);
				resolveRef.current?.();
			} catch (error) {
				console.error(`Migration error for ${dbName}:`, error);
				rejectRef.current?.(error);
			}
		});

		return () => {
			sqliteClient.terminate();
		};
	}, [sqliteClient, drizzle, migrations, dbName]);

	return { drizzle, readyPromise, sqliteClient };
};
