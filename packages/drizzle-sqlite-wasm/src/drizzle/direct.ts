import type { Database } from "../types";
import type { DrizzleConfig } from "drizzle-orm";
import { drizzle as drizzleSqliteProxy } from "drizzle-orm/sqlite-proxy";
import { handleRemoteCallback } from "./handle-callback";

export const drizzleSqliteWasm = <
	TSchema extends Record<string, unknown> = Record<string, never>,
>(
	sqliteDb: Database,
	config: DrizzleConfig<TSchema> = {},
	debug?: boolean,
) => {
	return drizzleSqliteProxy<TSchema>(async (sql, params, method) => {
		const result = await handleRemoteCallback({
			sqliteDb,
			sql,
			params,
			method,
			debug,
		});
		if (result.success) {
			return result.result;
		}
		// If the callback failed, throw an error for drizzle to handle
		throw new Error(result.error);
	}, config);
};
