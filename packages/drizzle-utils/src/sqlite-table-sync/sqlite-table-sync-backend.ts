import type { InferSchemaOutput } from "@tanstack/db";
import { and, eq, type SQL } from "drizzle-orm";
import type {
	SQLiteInsertValue,
	SQLiteUpdateSetSource,
} from "drizzle-orm/sqlite-core";
import type { SelectSchema, SyncBackend } from "../collection-utils";
import type { TableWithRequiredFields } from "../syncableTable";
import {
	convertBasicExpressionToDrizzle,
	convertOrderByToDrizzle,
} from "./convert-ir";
import type { SQLInterceptor } from "./types";

export type SqliteDriverMode = "async" | "sync";

export interface SqliteTableSyncBackendConfig<
	TTable extends TableWithRequiredFields,
> {
	/** drizzle-orm SQLite database (async WASM/libsql or sync Durable Object) */
	// biome-ignore lint/suspicious/noExplicitAny: generic over sync/async Drizzle DB shapes
	drizzle: any;
	table: TTable;
	tableName: string;
	debug?: boolean;
	checkpoint?: () => Promise<void>;
	interceptor?: SQLInterceptor;
	/**
	 * `async`: libsql/WASM — use `await db.transaction(async (tx) => …)`.
	 * `sync`: Cloudflare DO SQLite — `transactionSync` requires a **synchronous** callback; use `.all()` / `.run()` on builders inside `tx`.
	 */
	driverMode: SqliteDriverMode;
}

export function createSqliteTableSyncBackend<
	TTable extends TableWithRequiredFields,
>(config: SqliteTableSyncBackendConfig<TTable>): SyncBackend<TTable> {
	const table = config.table;
	const driverMode = config.driverMode;

	let transactionQueue = Promise.resolve();
	const queueTransaction = <T>(fn: () => Promise<T>): Promise<T> => {
		const result = transactionQueue.then(fn, fn);
		transactionQueue = result.then(
			() => {},
			() => {},
		);
		return result;
	};

	const backend: SyncBackend<TTable> = {
		initialLoad: async () => {
			const items = (await config.drizzle
				.select()
				.from(table)) as unknown as InferSchemaOutput<SelectSchema<TTable>>[];

			if (config.interceptor?.onOperation) {
				config.interceptor.onOperation({
					type: "select-all",
					tableName: config.tableName,
					itemsReturned: items,
					itemCount: items.length,
					context: "Initial load (eager mode)",
					timestamp: Date.now(),
				});
			}
			if (config.interceptor?.onOperation) {
				config.interceptor.onOperation({
					type: "write",
					tableName: config.tableName,
					itemsWritten: items,
					writeCount: items.length,
					context: "Initial load (eager mode)",
					timestamp: Date.now(),
				});
			}

			return items as unknown as InferSchemaOutput<SelectSchema<TTable>>[];
		},

		loadSubset: async (options) => {
			let query = config.drizzle.select().from(table).$dynamic();

			let hasWhere = false;
			if (options.where || options.cursor?.whereFrom) {
				let drizzleWhere: SQL | undefined;

				if (options.where && options.cursor?.whereFrom) {
					const mainWhere = convertBasicExpressionToDrizzle(
						options.where,
						table,
					);
					const cursorWhere = convertBasicExpressionToDrizzle(
						options.cursor.whereFrom,
						table,
					);
					drizzleWhere = and(mainWhere, cursorWhere);
				} else if (options.where) {
					drizzleWhere = convertBasicExpressionToDrizzle(options.where, table);
				} else if (options.cursor?.whereFrom) {
					drizzleWhere = convertBasicExpressionToDrizzle(
						options.cursor.whereFrom,
						table,
					);
				}

				if (drizzleWhere) {
					query = query.where(drizzleWhere);
					hasWhere = true;
				}
			}

			if (options.orderBy) {
				const drizzleOrderBy = convertOrderByToDrizzle(options.orderBy, table);
				query = query.orderBy(...drizzleOrderBy);
			}

			if (options.limit !== undefined) {
				query = query.limit(options.limit);
			}

			if (options.offset !== undefined && options.offset > 0) {
				query = query.offset(options.offset);
			}

			const items = (await query) as unknown as InferSchemaOutput<
				SelectSchema<TTable>
			>[];

			if (config.interceptor?.onOperation) {
				const contextParts: string[] = ["On-demand load"];
				if (options.orderBy) contextParts.push("with sorting");
				if (options.limit !== undefined)
					contextParts.push(`limit ${options.limit}`);
				if (options.offset !== undefined && options.offset > 0)
					contextParts.push(`offset ${options.offset}`);
				if (options.cursor) contextParts.push("with cursor pagination");

				if (hasWhere) {
					config.interceptor.onOperation({
						type: "select-where",
						tableName: config.tableName,
						whereClause: "WHERE clause applied",
						itemsReturned: items,
						itemCount: items.length,
						context: contextParts.join(", "),
						timestamp: Date.now(),
					});
				} else {
					config.interceptor.onOperation({
						type: "select-all",
						tableName: config.tableName,
						itemsReturned: items,
						itemCount: items.length,
						context: contextParts.join(", "),
						timestamp: Date.now(),
					});
				}
			}

			if (config.interceptor?.onOperation) {
				const contextParts: string[] = ["On-demand load"];
				if (hasWhere) contextParts.push("with WHERE clause");
				if (options.orderBy) contextParts.push("with sorting");
				if (options.limit !== undefined)
					contextParts.push(`limit ${options.limit}`);
				if (options.offset !== undefined && options.offset > 0)
					contextParts.push(`offset ${options.offset}`);

				config.interceptor.onOperation({
					type: "write",
					tableName: config.tableName,
					itemsWritten: items,
					writeCount: items.length,
					context: contextParts.join(", "),
					timestamp: Date.now(),
				});
			}

			return items as unknown as InferSchemaOutput<SelectSchema<TTable>>[];
		},

		handleInsert: async (items) => {
			const results: Array<InferSchemaOutput<SelectSchema<TTable>>> = [];

			await queueTransaction(async () => {
				if (driverMode === "sync") {
					config.drizzle.transaction((tx: typeof config.drizzle) => {
						for (const itemToInsert of items) {
							if (config.debug) {
								console.log(
									`[${new Date().toISOString()}] insertListener inserting`,
									itemToInsert,
								);
							}
							const result = tx
								.insert(table)
								.values(
									itemToInsert as unknown as SQLiteInsertValue<typeof table>,
								)
								.returning()
								.all() as Array<InferSchemaOutput<SelectSchema<TTable>>>;
							if (config.debug) {
								console.log(
									`[${new Date().toISOString()}] insertListener result`,
									result,
								);
							}
							if (result.length > 0) {
								results.push(result[0]);
							}
						}
					});
				} else {
					await config.drizzle.transaction(
						async (tx: typeof config.drizzle) => {
							for (const itemToInsert of items) {
								if (config.debug) {
									console.log(
										`[${new Date().toISOString()}] insertListener inserting`,
										itemToInsert,
									);
								}
								const result = (await tx
									.insert(table)
									.values(
										itemToInsert as unknown as SQLiteInsertValue<typeof table>,
									)
									.returning()) as Array<
									InferSchemaOutput<SelectSchema<TTable>>
								>;
								if (config.debug) {
									console.log(
										`[${new Date().toISOString()}] insertListener result`,
										result,
									);
								}
								if (result.length > 0) {
									results.push(result[0]);
								}
							}
						},
					);
				}

				if (config.checkpoint) {
					await config.checkpoint();
				}
			});

			return results;
		},

		handleUpdate: async (mutations) => {
			const results: Array<InferSchemaOutput<SelectSchema<TTable>>> = [];

			await queueTransaction(async () => {
				if (driverMode === "sync") {
					config.drizzle.transaction((tx: typeof config.drizzle) => {
						for (const mutation of mutations) {
							if (config.debug) {
								console.log(
									`[${new Date().toISOString()}] updateListener updating`,
									mutation,
								);
							}
							const updateTime = new Date();
							const result = tx
								.update(table)
								.set({
									...mutation.changes,
									updatedAt: updateTime,
								} as SQLiteUpdateSetSource<typeof table>)
								// biome-ignore lint/suspicious/noExplicitAny: branded id key
								.where(eq(table.id, mutation.key as any))
								.returning()
								.all() as Array<InferSchemaOutput<SelectSchema<TTable>>>;
							if (config.debug) {
								console.log(
									`[${new Date().toISOString()}] updateListener result`,
									result,
								);
							}
							results.push(...result);
						}
					});
				} else {
					await config.drizzle.transaction(
						async (tx: typeof config.drizzle) => {
							for (const mutation of mutations) {
								if (config.debug) {
									console.log(
										`[${new Date().toISOString()}] updateListener updating`,
										mutation,
									);
								}
								const updateTime = new Date();
								const result = (await tx
									.update(table)
									.set({
										...mutation.changes,
										updatedAt: updateTime,
									} as SQLiteUpdateSetSource<typeof table>)
									// biome-ignore lint/suspicious/noExplicitAny: branded id key
									.where(eq(table.id, mutation.key as any))
									.returning()) as Array<
									InferSchemaOutput<SelectSchema<TTable>>
								>;
								if (config.debug) {
									console.log(
										`[${new Date().toISOString()}] updateListener result`,
										result,
									);
								}
								results.push(...result);
							}
						},
					);
				}

				if (config.checkpoint) {
					await config.checkpoint();
				}
			});

			return results;
		},

		handleDelete: async (mutations) => {
			await queueTransaction(async () => {
				if (driverMode === "sync") {
					config.drizzle.transaction((tx: typeof config.drizzle) => {
						for (const mutation of mutations) {
							tx.delete(table)
								// biome-ignore lint/suspicious/noExplicitAny: branded id key
								.where(eq(table.id, mutation.key as any))
								.run();
						}
					});
				} else {
					await config.drizzle.transaction(
						async (tx: typeof config.drizzle) => {
							for (const mutation of mutations) {
								await tx
									.delete(table)
									// biome-ignore lint/suspicious/noExplicitAny: branded id key
									.where(eq(table.id, mutation.key as any));
							}
						},
					);
				}

				if (config.checkpoint) {
					await config.checkpoint();
				}
			});
		},
	};

	return backend;
}
