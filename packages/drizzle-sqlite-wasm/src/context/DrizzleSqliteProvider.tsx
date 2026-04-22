import type { PropsWithChildren, ReactNode } from "react";
import {
	createContext,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import {
	createCollection,
	type Collection,
	type InferSchemaOutput,
	type UtilsRecord,
} from "@tanstack/db";
import {
	type AnyDrizzleDatabase,
	type ValidTableNames,
	type DrizzleSchema,
	sqliteCollectionOptions,
} from "../collections/sqlite-collection";
import type { SQLInterceptor } from "@firtoz/drizzle-utils";
import { useDrizzleSqliteDb } from "../hooks/useDrizzleSqliteDb";
import type { DurableSqliteMigrationConfig } from "../migration/migrator";
import type { SqliteWasmWorkerOpenOptions } from "../worker/sqlite-open-options";
import type { ISqliteWorkerClient } from "../worker/manager";
import type {
	IdOf,
	GetTableFromSchema,
	InferCollectionFromTable,
} from "@firtoz/drizzle-utils";

/** @internal */
interface CollectionCacheEntry {
	// biome-ignore lint/suspicious/noExplicitAny: Cache needs to store collections of various types
	collection: Collection<any, string>;
	refCount: number;
}

type SqliteCollection<
	TSchema extends Record<string, unknown>,
	TTableName extends string & ValidTableNames<TSchema>,
> = Collection<
	InferSchemaOutput<GetTableFromSchema<TSchema, TTableName>["$inferSelect"]>,
	IdOf<GetTableFromSchema<TSchema, TTableName>>,
	// biome-ignore lint/suspicious/noExplicitAny: We need to use any here to match the Collection type
	any,
	// biome-ignore lint/suspicious/noExplicitAny: We need to use any here to match the Collection type
	any,
	Omit<GetTableFromSchema<TSchema, TTableName>["$inferInsert"], "id"> & {
		id?: IdOf<GetTableFromSchema<TSchema, TTableName>>;
	}
>;

/**
 * Exposed only when `sessionStatus === "ready"`. `useDrizzleSqlite` and
 * `useSqliteCollection` require this value — they must run under the
 * ready subtree of {@link DrizzleSqliteProvider} (i.e. not during loading fallback).
 */
export type DrizzleSqliteContextValue<TSchema extends Record<string, unknown>> =
	{
		drizzle: SqliteRemoteDatabase<TSchema>;
		readyPromise: Promise<void>;
		/**
		 * Worker client for this DB. Present whenever the ready subtree is mounted
		 * (including SSR no-op client).
		 */
		sqliteClient: ISqliteWorkerClient;
		/** Bumps when collection caches must be discarded (drizzle/options identity change). */
		collectionCacheEpoch: number;
		getCollection: <TTableName extends string & ValidTableNames<TSchema>>(
			tableName: TTableName,
		) => SqliteCollection<TSchema, TTableName>;
		incrementRefCount: (tableName: string) => void;
		decrementRefCount: (tableName: string) => void;
	};

export const DrizzleSqliteContext =
	// biome-ignore lint/suspicious/noExplicitAny: Context needs to accept any schema type
	createContext<DrizzleSqliteContextValue<any> | null>(null);

type DrizzleSqliteProviderProps<TSchema extends Record<string, unknown>> =
	PropsWithChildren<{
		worker: new () => Worker;
		/**
		 * File / logical name for the OPFS (or in-memory) DB. The ready subtree remounts when
		 * this or `workerOpenOptions` (serialized) changes, so in-tree state resets for a
		 * new file/session.
		 */
		dbName: string;
		schema: TSchema;
		migrations: DurableSqliteMigrationConfig;
		debug?: boolean;
		enableCheckpoint?: boolean;
		/**
		 * Shown on the client while the worker is starting and migrations are running
		 * (`sessionStatus` is not `"ready"`). Not shown for SSR (session is `ready` with a no-op client).
		 */
		loadingFallback: ReactNode;
		/**
		 * Optional UI when migrations fail. Defaults to a short error message in development.
		 */
		errorFallback?: ReactNode;
		/**
		 * Sync mode: 'eager' (immediate) or 'on-demand' (lazy)
		 */
		syncMode?: "eager" | "on-demand";
		/**
		 * Optional interceptor for tracking SQLite operations (for testing/debugging).
		 * Inline `{ onOperation }` objects are fine: the provider keeps a stable wrapper so
		 * collection caches and context are not invalidated on every parent re-render. You
		 * can still pass a module-level or `useMemo`d object if you prefer.
		 */
		interceptor?: SQLInterceptor;
		/**
		 * Worker DB pragmas on first open of `dbName` this session (see `useDrizzleSqliteDb`).
		 * If this changes for the same `dbName`, the global worker may still return the existing
		 * open DB — use a distinct `dbName` or remount the worker session if you need new pragmas.
		 */
		workerOpenOptions?: SqliteWasmWorkerOpenOptions;
	}>;

type DrizzleSqliteSessionBodyProps<TSchema extends Record<string, unknown>> = {
	children: ReactNode;
	interceptor: SQLInterceptor | undefined;
	debug: boolean | undefined;
	enableCheckpoint: boolean;
	syncMode: "eager" | "on-demand";
	drizzle: SqliteRemoteDatabase<TSchema>;
	readyPromise: Promise<void>;
	sqliteClient: ISqliteWorkerClient;
};

/**
 * One mounted provider subtree = one open DB. The parent {@link DrizzleSqliteProvider} gives
 * this node a `key` derived from `dbName` + `workerOpenOptions` so when the logical file (or
 * open options) changes, in-memory React state and collection caches reset.
 */
function DrizzleSqliteSessionBody<TSchema extends Record<string, unknown>>({
	children,
	interceptor,
	drizzle,
	readyPromise,
	sqliteClient,
	debug,
	enableCheckpoint,
	syncMode,
}: DrizzleSqliteSessionBodyProps<TSchema>) {
	const interceptorRef = useRef(interceptor);
	interceptorRef.current = interceptor;

	const [collectionCacheEpoch, setCollectionCacheEpoch] = useState(0);
	const collections = useMemo(
		() => new Map<string, CollectionCacheEntry>(),
		[],
	);

	/**
	 * Stable `onOperation` identity when an interceptor is enabled, so `getCollection` does
	 * not churn on unrelated re-renders (object props are usually a new reference each time).
	 */
	const stableInterceptor: SQLInterceptor | undefined = useMemo(
		() =>
			interceptor
				? { onOperation: (op) => interceptorRef.current?.onOperation?.(op) }
				: undefined,
		[!!interceptor],
	);

	// When `drizzle` or options that feed `sqliteCollectionOptions` / TanStack sync change,
	// drop cached `createCollection` instances. This `useEffect` **setup** runs *after* the
	// commit that already has the new `drizzle` / flags; we `clear` + bump `collectionCacheEpoch`
	// so the next `getCollection` / `useSqliteCollection` pass uses a new key and repopulates
	// the map with up-to-date options.
	//
	// `useEffect` **cleanup** (`return () => { ... }`, if we added one) would run *after* a
	// *later* commit, immediately **before** the next time this setup runs (next dep change) or
	// **on unmount**—not “before the tree sees new values”. Props for a given render are fixed
	// for that render; this setup always sees the latest `drizzle` / options from the render
	// that just committed. We only need the setup here; the Map is not shared across
	// unmounted instances, so we do not rely on cleanup for invalidation.
	useEffect(() => {
		collections.clear();
		setCollectionCacheEpoch((e) => e + 1);
	}, [drizzle, enableCheckpoint, syncMode, debug]);

	const getCollection = useCallback(
		<TTableName extends string & ValidTableNames<TSchema>>(
			tableName: TTableName,
		): SqliteCollection<TSchema, TTableName> => {
			const cacheKey = `${collectionCacheEpoch}:${String(tableName)}`;
			if (!collections.has(cacheKey)) {
				const options = sqliteCollectionOptions({
					drizzle,
					tableName: tableName as string &
						ValidTableNames<DrizzleSchema<AnyDrizzleDatabase>>,
					readyPromise,
					syncMode,
					checkpoint: enableCheckpoint
						? () => sqliteClient.checkpoint()
						: undefined,
					interceptor: stableInterceptor,
					debug,
				});
				// biome-ignore lint/suspicious/noExplicitAny: Table type degenerates through AnyDrizzleDatabase; collection is re-typed on cache retrieval
				const collection = createCollection(options as any) as Collection<
					Record<string, unknown>,
					string,
					UtilsRecord
				>;
				collections.set(cacheKey, { collection, refCount: 0 });
			}
			// biome-ignore lint/style/noNonNullAssertion: We just ensured the collection exists
			return collections.get(cacheKey)!
				.collection as unknown as SqliteCollection<TSchema, TTableName>;
		},
		[
			collectionCacheEpoch,
			collections,
			drizzle,
			readyPromise,
			syncMode,
			enableCheckpoint,
			sqliteClient,
			stableInterceptor,
			debug,
		],
	);

	const incrementRefCount: DrizzleSqliteContextValue<TSchema>["incrementRefCount"] =
		useCallback(
			(tableName: string) => {
				const k = `${collectionCacheEpoch}:${String(tableName)}`;
				const entry = collections.get(k);
				if (entry) {
					entry.refCount++;
				}
			},
			[collectionCacheEpoch, collections],
		);

	const decrementRefCount: DrizzleSqliteContextValue<TSchema>["decrementRefCount"] =
		useCallback(
			(tableName: string) => {
				const k = `${collectionCacheEpoch}:${String(tableName)}`;
				const entry = collections.get(k);
				if (entry) {
					entry.refCount--;
					if (entry.refCount <= 0) {
						collections.delete(k);
					}
				}
			},
			[collectionCacheEpoch, collections],
		);

	const contextValue: DrizzleSqliteContextValue<TSchema> = useMemo(
		() => ({
			drizzle,
			readyPromise,
			sqliteClient,
			collectionCacheEpoch,
			getCollection,
			incrementRefCount,
			decrementRefCount,
		}),
		[
			drizzle,
			readyPromise,
			sqliteClient,
			collectionCacheEpoch,
			getCollection,
			incrementRefCount,
			decrementRefCount,
		],
	);

	return (
		<DrizzleSqliteContext.Provider value={contextValue}>
			{children}
		</DrizzleSqliteContext.Provider>
	);
}

/**
 * Provides a single SQLite+Worker session for `dbName`. Children that call
 * {@link useDrizzleSqlite} or {@link useSqliteCollection} are only mounted
 * after migrations succeed (see `loadingFallback` while not ready).
 *
 * **Session identity** is `dbName` + `workerOpenOptions` (the ready subtree `key` is derived
 * internally; you do not need to set `key` on this component for normal DB switching).
 */
export function DrizzleSqliteProvider<TSchema extends Record<string, unknown>>({
	children,
	worker,
	dbName,
	schema,
	migrations,
	debug,
	enableCheckpoint = false,
	loadingFallback,
	errorFallback,
	syncMode = "eager",
	interceptor,
	workerOpenOptions,
}: DrizzleSqliteProviderProps<TSchema>) {
	/** Drives a fresh `DrizzleSqliteSessionBody` + `children` when the DB file or open options change. */
	const readySubtreeKey = useMemo(
		() =>
			`drizzle-sqlite:${dbName}:${JSON.stringify(workerOpenOptions ?? null)}`,
		[dbName, workerOpenOptions],
	);

	const session = useDrizzleSqliteDb(
		worker,
		dbName,
		schema,
		migrations,
		debug,
		interceptor,
		workerOpenOptions,
	);
	const { drizzle, readyPromise, sqliteClient, sessionStatus } = session;

	if (sessionStatus === "error") {
		return (
			<>
				{errorFallback ?? (
					<div role="alert" data-testid="sqlite-db-error">
						{session.sessionError.message}
					</div>
				)}
			</>
		);
	}

	if (sessionStatus !== "ready" || !sqliteClient) {
		return <>{loadingFallback}</>;
	}

	return (
		<DrizzleSqliteSessionBody
			key={readySubtreeKey}
			interceptor={interceptor}
			debug={debug}
			enableCheckpoint={enableCheckpoint}
			syncMode={syncMode}
			drizzle={drizzle}
			readyPromise={readyPromise}
			sqliteClient={sqliteClient}
		>
			{children}
		</DrizzleSqliteSessionBody>
	);
}

// Hook that components use to get a collection with automatic ref counting
export function useSqliteCollection<
	TSchema extends Record<string, unknown>,
	TTableName extends string & ValidTableNames<TSchema>,
>(
	context: DrizzleSqliteContextValue<TSchema>,
	tableName: TTableName,
): InferCollectionFromTable<GetTableFromSchema<TSchema, TTableName>> {
	const { collection, unsubscribe } = useMemo(() => {
		const col = context.getCollection(tableName);
		context.incrementRefCount(tableName);

		return {
			collection: col,
			unsubscribe: () => {
				context.decrementRefCount(tableName);
			},
		};
		// Re-bind when a new table collection is required (epoch bump or context swap)
	}, [context, tableName, context.collectionCacheEpoch]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			unsubscribe();
		};
	}, [unsubscribe]);

	return collection as unknown as InferCollectionFromTable<
		GetTableFromSchema<TSchema, TTableName>
	>;
}
