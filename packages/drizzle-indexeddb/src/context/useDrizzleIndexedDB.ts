import { useContext } from "react";
import {
	DrizzleIndexedDBContext,
	useIndexedDBCollection,
	type DrizzleIndexedDBContextValue,
} from "./DrizzleIndexedDBProvider";
import type { IDBDatabaseLike } from "../idb-types";

export type UseDrizzleIndexedDBContextReturn<
	TSchema extends Record<string, unknown>,
> = {
	useCollection: <TTableName extends keyof TSchema & string>(
		tableName: TTableName,
	) => ReturnType<typeof useIndexedDBCollection<TSchema, TTableName>>;
	indexedDB: IDBDatabaseLike | null;
};

export function useDrizzleIndexedDB<
	TSchema extends Record<string, unknown>,
>(): UseDrizzleIndexedDBContextReturn<TSchema> {
	const context = useContext(
		DrizzleIndexedDBContext,
	) as DrizzleIndexedDBContextValue<TSchema> | null;

	if (!context) {
		throw new Error(
			"useDrizzleIndexedDBContext must be used within a DrizzleIndexedDBProvider",
		);
	}

	return {
		useCollection: <TTableName extends keyof TSchema & string>(
			tableName: TTableName,
		) => useIndexedDBCollection(context, tableName),
		indexedDB: context.indexedDB,
	};
}
