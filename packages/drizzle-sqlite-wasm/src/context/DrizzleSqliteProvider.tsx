import type { PropsWithChildren } from "react";
import { createContext, useMemo, useCallback, useEffect } from "react";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import {
	createCollection,
	type Collection,
	type InferSchemaOutput,
} from "@tanstack/db";
import {
	type AnyDrizzleDatabase,
	type ValidTableNames,
	type DrizzleSchema,
	sqliteCollectionOptions,
} from "../collections/sqlite-collection";
import { useDrizzleSqliteDb } from "../hooks/useDrizzleSqliteDb";
import type { DurableSqliteMigrationConfig } from "../migration/migrator";
import type {
	IdOf,
	GetTableFromSchema,
	InferCollectionFromTable,
} from "@firtoz/drizzle-utils";

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

export type DrizzleSqliteContextValue<TSchema extends Record<string, unknown>> =
	{
		drizzle: SqliteRemoteDatabase<TSchema>;
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
		dbName: string;
		schema: TSchema;
		migrations: DurableSqliteMigrationConfig;
		debug?: boolean;
		enableCheckpoint?: boolean;
	}>;

export function DrizzleSqliteProvider<TSchema extends Record<string, unknown>>({
	children,
	worker,
	dbName,
	schema,
	migrations,
	debug,
	enableCheckpoint = false,
}: DrizzleSqliteProviderProps<TSchema>) {
	const { drizzle, readyPromise, sqliteClient } = useDrizzleSqliteDb(
		worker,
		dbName,
		schema,
		migrations,
		debug,
	);

	// Collection cache with ref counting
	const collections = useMemo<Map<string, CollectionCacheEntry>>(
		() => new Map(),
		[],
	);

	const getCollection = useCallback(
		<TTableName extends string & ValidTableNames<TSchema>>(
			tableName: TTableName,
		): SqliteCollection<TSchema, TTableName> => {
			const cacheKey = tableName;

			// Check if collection already exists in cache
			if (!collections.has(cacheKey)) {
				// Create new collection and cache it with ref count 0
				const collection = createCollection(
					sqliteCollectionOptions({
						drizzle,
						tableName: tableName as string &
							ValidTableNames<DrizzleSchema<AnyDrizzleDatabase>>,
						readyPromise,
						// syncMode: "on-demand",
						checkpoint:
							enableCheckpoint && sqliteClient
								? () => sqliteClient.checkpoint()
								: undefined,
					}),
				) as any;
				collections.set(cacheKey, {
					collection,
					refCount: 0,
				});
			}

			// biome-ignore lint/style/noNonNullAssertion: We just ensured the collection exists
			return collections.get(cacheKey)!
				.collection as unknown as SqliteCollection<TSchema, TTableName>;
		},
		[drizzle, collections, readyPromise, sqliteClient, enableCheckpoint],
	);

	const incrementRefCount: DrizzleSqliteContextValue<TSchema>["incrementRefCount"] =
		useCallback(
			(tableName: string) => {
				const entry = collections.get(tableName);
				if (entry) {
					entry.refCount++;
				}
			},
			[collections],
		);

	const decrementRefCount: DrizzleSqliteContextValue<TSchema>["decrementRefCount"] =
		useCallback(
			(tableName: string) => {
				const entry = collections.get(tableName);
				if (entry) {
					entry.refCount--;

					// If ref count reaches 0, remove from cache
					if (entry.refCount <= 0) {
						collections.delete(tableName);
					}
				}
			},
			[collections],
		);

	const contextValue: DrizzleSqliteContextValue<TSchema> = useMemo(
		() => ({
			drizzle,
			getCollection,
			incrementRefCount,
			decrementRefCount,
		}),
		[drizzle, getCollection, incrementRefCount, decrementRefCount],
	);

	return (
		<DrizzleSqliteContext.Provider value={contextValue}>
			{children}
		</DrizzleSqliteContext.Provider>
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
		// Get the collection and increment ref count
		const col = context.getCollection(tableName);
		context.incrementRefCount(tableName);

		// Return collection and unsubscribe function
		return {
			collection: col,
			unsubscribe: () => {
				context.decrementRefCount(tableName);
			},
		};
	}, [context, tableName]);

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
