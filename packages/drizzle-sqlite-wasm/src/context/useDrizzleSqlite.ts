import { useContext } from "react";
import type { DrizzleSqliteContextValue } from "./DrizzleSqliteProvider";
import {
	DrizzleSqliteContext,
	useSqliteCollection,
} from "./DrizzleSqliteProvider";
import type { ValidTableNames } from "../collections/sqlite-collection";

export type UseDrizzleSqliteReturn<TSchema extends Record<string, unknown>> = {
	drizzle: DrizzleSqliteContextValue<TSchema>["drizzle"];
	readyPromise: DrizzleSqliteContextValue<TSchema>["readyPromise"];
	useCollection: <TTableName extends string & ValidTableNames<TSchema>>(
		tableName: TTableName,
	) => ReturnType<typeof useSqliteCollection<TSchema, TTableName>>;
};

export function useDrizzleSqlite<
	TSchema extends Record<string, unknown>,
>(): UseDrizzleSqliteReturn<TSchema> {
	const context = useContext(
		DrizzleSqliteContext,
	) as DrizzleSqliteContextValue<TSchema> | null;

	if (!context) {
		throw new Error(
			"useDrizzleSqlite must be used within a DrizzleSqliteProvider",
		);
	}

	return {
		drizzle: context.drizzle,
		readyPromise: context.readyPromise,
		useCollection: <TTableName extends string & ValidTableNames<TSchema>>(
			tableName: TTableName,
		) => useSqliteCollection(context, tableName),
	};
}
