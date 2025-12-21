import type { DrizzleConfig } from "drizzle-orm";
import { drizzle as drizzleSqliteProxy } from "drizzle-orm/sqlite-proxy";
import type { ISqliteWorkerClient } from "../worker/client";
import type {
	SQLInterceptor,
	SQLOperation,
} from "../collections/sqlite-collection";

export const drizzleSqliteWasmWorker = <
	TSchema extends Record<string, unknown> = Record<string, never>,
>(
	client: ISqliteWorkerClient,
	config: DrizzleConfig<TSchema> = {},
) => {
	return drizzleSqliteProxy<TSchema>(async (sql, params, method) => {
		return new Promise<{ rows: unknown[] }>((resolve, reject) => {
			client.performRemoteCallback(
				{
					sql,
					params,
					method,
				},
				resolve,
				reject,
			);
		});
	}, config);
};

/**
 * Creates an instrumented Drizzle instance that logs all SQL queries.
 * This wraps the standard drizzleSqliteWasmWorker to intercept every query.
 */
export const createInstrumentedDrizzle = <
	TSchema extends Record<string, unknown> = Record<string, never>,
>(
	client: ISqliteWorkerClient,
	config: DrizzleConfig<TSchema> = {},
	interceptor?: SQLInterceptor,
) => {
	return drizzleSqliteProxy<TSchema>(async (sql, params, method) => {
		const startTime = Date.now();

		const result = await new Promise<{ rows: unknown[] }>((resolve, reject) => {
			client.performRemoteCallback(
				{
					sql,
					params,
					method,
				},
				resolve,
				reject,
			);
		});

		// Log the operation if interceptor is provided
		if (interceptor?.onOperation) {
			// Parse SQL to determine context
			const sqlLower = sql.toLowerCase().trim();
			let context = "Direct Drizzle query";

			if (sqlLower.startsWith("select")) {
				// Extract table name from SELECT query
				const fromMatch = sql.match(/from\s+["']?(\w+)["']?/i);
				const tableName = fromMatch?.[1] || "unknown";

				// Check for LIMIT/OFFSET - handle both literal values and ? placeholders
				// Drizzle uses parameterized queries, so we need to check for `limit ?` style
				const hasLimit = /limit\s+(\d+|\?|\$\d+)/i.test(sql);
				const hasOffset = /offset\s+(\d+|\?|\$\d+)/i.test(sql);
				const hasOrderBy = /order\s+by/i.test(sql);

				if (hasLimit || hasOffset) {
					// Extract actual values from params if using placeholders
					// Drizzle typically puts LIMIT as second-to-last param, OFFSET as last
					let limitVal = "?";
					let offsetVal = "0";

					// Try to extract literal values first
					const literalLimit = sql.match(/limit\s+(\d+)/i);
					const literalOffset = sql.match(/offset\s+(\d+)/i);

					if (literalLimit) {
						limitVal = literalLimit[1];
					} else if (params && params.length > 0) {
						// For parameterized queries, try to infer from params
						// LIMIT/OFFSET are usually at the end
						if (hasLimit && hasOffset && params.length >= 2) {
							limitVal = String(params[params.length - 2]);
							offsetVal = String(params[params.length - 1]);
						} else if (hasLimit && params.length >= 1) {
							limitVal = String(params[params.length - 1]);
						}
					}

					if (literalOffset) {
						offsetVal = literalOffset[1];
					}

					context = `SELECT with LIMIT ${limitVal} OFFSET ${offsetVal}`;
				} else if (hasOrderBy) {
					context = `SELECT all from ${tableName} (ordered)`;
				} else {
					context = `SELECT all from ${tableName}`;
				}

				const operation: SQLOperation = {
					type: "raw-query",
					sql,
					params: params as unknown[],
					method,
					rowCount: result.rows?.length ?? 0,
					context,
					timestamp: startTime,
				};
				interceptor.onOperation(operation);
			} else if (sqlLower.startsWith("insert")) {
				const intoMatch = sql.match(/into\s+["']?(\w+)["']?/i);
				context = `INSERT into ${intoMatch?.[1] || "unknown"}`;

				const operation: SQLOperation = {
					type: "raw-query",
					sql,
					params: params as unknown[],
					method,
					rowCount: 0,
					context,
					timestamp: startTime,
				};
				interceptor.onOperation(operation);
			} else if (sqlLower.startsWith("update")) {
				const tableMatch = sql.match(/update\s+["']?(\w+)["']?/i);
				context = `UPDATE ${tableMatch?.[1] || "unknown"}`;

				const operation: SQLOperation = {
					type: "raw-query",
					sql,
					params: params as unknown[],
					method,
					rowCount: 0,
					context,
					timestamp: startTime,
				};
				interceptor.onOperation(operation);
			} else if (sqlLower.startsWith("delete")) {
				const fromMatch = sql.match(/from\s+["']?(\w+)["']?/i);
				context = `DELETE from ${fromMatch?.[1] || "unknown"}`;

				const operation: SQLOperation = {
					type: "raw-query",
					sql,
					params: params as unknown[],
					method,
					rowCount: 0,
					context,
					timestamp: startTime,
				};
				interceptor.onOperation(operation);
			}
		}

		return result;
	}, config);
};
