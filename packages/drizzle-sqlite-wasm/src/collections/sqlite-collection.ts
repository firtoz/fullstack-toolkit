import type {
	InferSchemaOutput,
	SyncMode,
	CollectionConfig,
} from "@tanstack/db";
import type { IR } from "@tanstack/db";
import {
	eq,
	sql,
	type Table,
	gt,
	gte,
	lt,
	lte,
	ne,
	and,
	or,
	not,
	isNull,
	isNotNull,
	like,
	inArray,
	asc,
	desc,
	type SQL,
} from "drizzle-orm";
import {
	type SQLiteUpdateSetSource,
	type BaseSQLiteDatabase,
	type SQLiteInsertValue,
	SQLiteColumn,
} from "drizzle-orm/sqlite-core";
import type {
	SelectSchema,
	TableWithRequiredFields,
	BaseSyncConfig,
	SyncBackend,
	CollectionUtils,
} from "@firtoz/drizzle-utils";
import {
	createSyncFunction,
	createInsertSchemaWithIdDefault,
	createGetKeyFunction,
	createCollectionConfig,
} from "@firtoz/drizzle-utils";
import type * as v from "valibot";

export type AnyDrizzleDatabase = BaseSQLiteDatabase<
	"async",
	// biome-ignore lint/suspicious/noExplicitAny: We really want to use any here.
	any,
	Record<string, unknown>
>;

export type DrizzleSchema<TDrizzle extends AnyDrizzleDatabase> =
	TDrizzle["_"]["fullSchema"];

/**
 * Operation tracking for SQLite queries
 * Useful for testing and debugging to verify what operations are actually performed
 *
 * Uses discriminated unions for type safety - TypeScript can narrow the type based on the 'type' field
 */
export type SQLOperation =
	| {
			type: "select-all";
			tableName: string;
			itemsReturned: unknown[];
			itemCount: number;
			context: string;
			sql?: string;
			timestamp: number;
	  }
	| {
			type: "select-where";
			tableName: string;
			whereClause: string;
			itemsReturned: unknown[];
			itemCount: number;
			context: string;
			sql?: string;
			timestamp: number;
	  }
	| {
			type: "write";
			tableName: string;
			itemsWritten: unknown[];
			writeCount: number;
			context: string;
			timestamp: number;
	  }
	| {
			type: "insert";
			tableName: string;
			item: unknown;
			sql?: string;
			timestamp: number;
	  }
	| {
			type: "update";
			tableName: string;
			updates: unknown;
			sql?: string;
			timestamp: number;
	  }
	| {
			type: "delete";
			tableName: string;
			sql?: string;
			timestamp: number;
	  }
	| {
			/** Raw SQL query executed directly via Drizzle (not through collection) */
			type: "raw-query";
			sql: string;
			params?: unknown[];
			method: string;
			rowCount: number;
			context: string;
			timestamp: number;
	  };

/**
 * Interceptor interface for tracking SQLite operations
 * Allows tests and debugging tools to observe what operations are performed
 */
export interface SQLInterceptor {
	/** Called when any SQLite operation is performed */
	onOperation?: (operation: SQLOperation) => void;
}

export interface DrizzleCollectionConfig<
	TDrizzle extends AnyDrizzleDatabase,
	TTableName extends ValidTableNames<DrizzleSchema<TDrizzle>>,
> {
	drizzle: TDrizzle;
	tableName: ValidTableNames<DrizzleSchema<TDrizzle>> extends never
		? {
				$error: "The schema needs to include at least one table that uses the syncableTable function.";
			}
		: TTableName;
	readyPromise: Promise<void>;
	syncMode?: SyncMode;
	/**
	 * Enable debug logging for query execution and mutations
	 */
	debug?: boolean;
	/**
	 * Optional callback to checkpoint the database after mutations
	 * This ensures WAL is flushed to the main database file for OPFS persistence
	 */
	checkpoint?: () => Promise<void>;
	/**
	 * Optional interceptor for tracking SQLite operations (for testing/debugging)
	 */
	interceptor?: SQLInterceptor;
}

export type ValidTableNames<TSchema extends Record<string, unknown>> = {
	[K in keyof TSchema]: TSchema[K] extends TableWithRequiredFields ? K : never;
}[keyof TSchema];

/**
 * Return type for sqliteCollectionOptions - configuration object for creating SQLite collections
 *
 * Note: The third type parameter of CollectionConfig uses `any` to maintain compatibility with
 * TanStack DB's type system, which expects different schema types in different contexts.
 */
export type SqliteCollectionConfig<TTable extends Table> = Omit<
	CollectionConfig<
		InferSchemaOutput<SelectSchema<TTable>>,
		string,
		// biome-ignore lint/suspicious/noExplicitAny: Required for TanStack DB type compatibility
		any
	>,
	"utils"
> & {
	schema: v.GenericSchema<unknown>;
	utils: CollectionUtils<InferSchemaOutput<SelectSchema<TTable>>>;
};

/**
 * Converts TanStack DB IR BasicExpression to Drizzle SQL expression
 *
 * Supported operators that TanStack DB pushes down to backend (SUPPORTED_COLLECTION_FUNCS):
 * - eq, gt, lt, gte, lte, and, or, in, isNull, isUndefined, not
 *
 * Additional operators handled for completeness (won't be pushed down in on-demand mode):
 * - ne, isNotNull, like
 */
function convertBasicExpressionToDrizzle<TTable extends Table>(
	expression: IR.BasicExpression,
	table: TTable,
): SQL {
	if (expression.type === "ref") {
		// PropRef - reference to a column
		const propRef = expression as IR.PropRef;
		const columnName = propRef.path[propRef.path.length - 1];
		const column = table[columnName as keyof typeof table];

		if (!column || !(column instanceof SQLiteColumn)) {
			console.error("[SQLite Collection] Column lookup failed:", {
				columnName,
				column,
				tableKeys: Object.keys(table),
				hasColumn: columnName in table,
			});
			throw new Error(`Column ${String(columnName)} not found in table`);
		}

		// Drizzle columns can be used directly in expressions
		return column as unknown as SQL;
	}

	if (expression.type === "val") {
		// Value - literal value
		const value = expression as IR.Value;
		return sql`${value.value}`;
	}

	if (expression.type === "func") {
		// Func - function call like eq, gt, lt, etc.
		const func = expression as IR.Func;
		const args = func.args.map((arg) =>
			convertBasicExpressionToDrizzle(arg, table),
		);

		switch (func.name) {
			case "eq":
				return eq(args[0], args[1]);
			case "ne":
				return ne(args[0], args[1]);
			case "gt":
				return gt(args[0], args[1]);
			case "gte":
				return gte(args[0], args[1]);
			case "lt":
				return lt(args[0], args[1]);
			case "lte":
				return lte(args[0], args[1]);
			case "and": {
				const result = and(...args);
				if (!result) {
					throw new Error("Invalid 'and' expression - no arguments provided");
				}
				return result;
			}
			case "or": {
				const result = or(...args);
				if (!result) {
					throw new Error("Invalid 'or' expression - no arguments provided");
				}
				return result;
			}
			case "not":
				return not(args[0]);
			case "isNull":
				return isNull(args[0]);
			case "isNotNull":
				return isNotNull(args[0]);
			case "like":
				return like(args[0], args[1]);
			case "in":
				return inArray(args[0], args[1]);
			case "isUndefined":
				// isUndefined is same as isNull in SQLite
				return isNull(args[0]);
			default:
				throw new Error(`Unsupported function: ${func.name}`);
		}
	}

	throw new Error(
		`Unsupported expression type: ${(expression as { type: string }).type}`,
	);
}

/**
 * Converts TanStack DB OrderBy to Drizzle orderBy
 */
function convertOrderByToDrizzle<TTable extends Table>(
	orderBy: IR.OrderBy,
	table: TTable,
): SQL[] {
	return orderBy.map((clause) => {
		const expression = convertBasicExpressionToDrizzle(
			clause.expression,
			table,
		);
		const direction = clause.compareOptions.direction || "asc";

		return direction === "asc" ? asc(expression) : desc(expression);
	});
}

export function sqliteCollectionOptions<
	const TDrizzle extends AnyDrizzleDatabase,
	const TTableName extends string & ValidTableNames<DrizzleSchema<TDrizzle>>,
	TTable extends DrizzleSchema<TDrizzle>[TTableName] & TableWithRequiredFields,
>(
	config: DrizzleCollectionConfig<TDrizzle, TTableName>,
): SqliteCollectionConfig<TTable> {
	const tableName = config.tableName as string &
		ValidTableNames<DrizzleSchema<TDrizzle>>;

	const table = config.drizzle?._.fullSchema[tableName] as TTable;

	// Transaction queue to serialize SQLite transactions (SQLite only supports one transaction at a time)
	// The queue ensures transactions run sequentially and continues even if one fails
	let transactionQueue = Promise.resolve();
	const queueTransaction = <T>(fn: () => Promise<T>): Promise<T> => {
		// Chain this transaction after the previous one (whether it succeeded or failed)
		const result = transactionQueue.then(fn, fn);
		// Update the queue to continue after this transaction completes (success or failure)
		// This ensures the queue doesn't get stuck if a transaction fails
		transactionQueue = result.then(
			() => {}, // Success handler - return undefined to reset queue
			() => {}, // Error handler - return undefined to reset queue (queue continues)
		);
		// Return the actual result so errors propagate to the caller
		return result;
	};

	// Create backend-specific implementation
	const backend: SyncBackend<TTable> = {
		initialLoad: async (write) => {
			const items = (await config.drizzle
				.select()
				.from(table)) as unknown as InferSchemaOutput<SelectSchema<TTable>>[];

			// Log SQL operation
			if (config.interceptor?.onOperation) {
				config.interceptor.onOperation({
					type: "select-all",
					tableName: config.tableName as string,
					itemsReturned: items,
					itemCount: items.length,
					context: "Initial load (eager mode)",
					timestamp: Date.now(),
				});
			}

			// Log write operation
			if (config.interceptor?.onOperation) {
				config.interceptor.onOperation({
					type: "write",
					tableName: config.tableName as string,
					itemsWritten: items,
					writeCount: items.length,
					context: "Initial load (eager mode)",
					timestamp: Date.now(),
				});
			}

			for (const item of items) {
				write(item);
			}
		},

		loadSubset: async (options, write) => {
			// Build the query with optional where, orderBy, limit, and offset
			// Use $dynamic() to enable dynamic query building
			let query = config.drizzle.select().from(table).$dynamic();

			// Combine where with cursor expressions if present
			// The cursor.whereFrom gives us rows after the cursor position
			let hasWhere = false;
			if (options.where || options.cursor?.whereFrom) {
				let drizzleWhere: SQL | undefined;

				if (options.where && options.cursor?.whereFrom) {
					// Combine main where with cursor expression using AND
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

			// Apply offset for offset-based pagination
			if (options.offset !== undefined && options.offset > 0) {
				query = query.offset(options.offset);
			}

			const items = (await query) as unknown as InferSchemaOutput<
				SelectSchema<TTable>
			>[];

			// Log SQL operation
			if (config.interceptor?.onOperation) {
				const contextParts: string[] = ["On-demand load"];
				if (options.orderBy) {
					contextParts.push("with sorting");
				}
				if (options.limit !== undefined) {
					contextParts.push(`limit ${options.limit}`);
				}
				if (options.offset !== undefined && options.offset > 0) {
					contextParts.push(`offset ${options.offset}`);
				}
				if (options.cursor) {
					contextParts.push("with cursor pagination");
				}

				if (hasWhere) {
					config.interceptor.onOperation({
						type: "select-where",
						tableName: config.tableName as string,
						whereClause: "WHERE clause applied",
						itemsReturned: items,
						itemCount: items.length,
						context: contextParts.join(", "),
						timestamp: Date.now(),
					});
				} else {
					config.interceptor.onOperation({
						type: "select-all",
						tableName: config.tableName as string,
						itemsReturned: items,
						itemCount: items.length,
						context: contextParts.join(", "),
						timestamp: Date.now(),
					});
				}
			}

			// Log write operation
			if (config.interceptor?.onOperation) {
				const contextParts: string[] = ["On-demand load"];
				if (hasWhere) {
					contextParts.push("with WHERE clause");
				}
				if (options.orderBy) {
					contextParts.push("with sorting");
				}
				if (options.limit !== undefined) {
					contextParts.push(`limit ${options.limit}`);
				}
				if (options.offset !== undefined && options.offset > 0) {
					contextParts.push(`offset ${options.offset}`);
				}

				config.interceptor.onOperation({
					type: "write",
					tableName: config.tableName as string,
					itemsWritten: items,
					writeCount: items.length,
					context: contextParts.join(", "),
					timestamp: Date.now(),
				});
			}

			for (const item of items) {
				write(item);
			}
		},

		handleInsert: async (mutations) => {
			const results: Array<InferSchemaOutput<SelectSchema<TTable>>> = [];

			// Queue the transaction to serialize SQLite operations
			await queueTransaction(async () => {
				await config.drizzle.transaction(async (tx) => {
					for (const mutation of mutations) {
						// TanStack DB applies schema transform (including ID default) before calling this listener
						// So mutation.modified already has the ID from insertSchemaWithIdDefault
						const itemToInsert = mutation.modified;

						if (config.debug) {
							console.log(
								`[${new Date().toISOString()}] insertListener inserting`,
								itemToInsert,
							);
						}

						const result: Array<InferSchemaOutput<SelectSchema<TTable>>> =
							(await tx
								.insert(table)
								.values(
									itemToInsert as unknown as SQLiteInsertValue<typeof table>,
								)
								.returning()) as Array<InferSchemaOutput<SelectSchema<TTable>>>;

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

				// Checkpoint to ensure WAL is flushed to main DB file
				if (config.checkpoint) {
					await config.checkpoint();
				}
			});

			return results;
		},

		handleUpdate: async (mutations) => {
			const results: Array<InferSchemaOutput<SelectSchema<TTable>>> = [];

			// Queue the transaction to serialize SQLite operations
			await queueTransaction(async () => {
				await config.drizzle.transaction(async (tx) => {
					for (const mutation of mutations) {
						if (config.debug) {
							console.log(
								`[${new Date().toISOString()}] updateListener updating`,
								mutation,
							);
						}

						const updateTime = new Date();
						const result: Array<InferSchemaOutput<SelectSchema<TTable>>> =
							(await tx
								.update(table)
								.set({
									...mutation.changes,
									updatedAt: updateTime,
								} as SQLiteUpdateSetSource<typeof table>)
								// biome-ignore lint/suspicious/noExplicitAny: Key is string but table.id is branded type
								.where(eq(table.id, mutation.key as any))
								.returning()) as Array<InferSchemaOutput<SelectSchema<TTable>>>;

						if (config.debug) {
							console.log(
								`[${new Date().toISOString()}] updateListener result`,
								result,
							);
						}

						results.push(...result);
					}
				});

				// Checkpoint to ensure WAL is flushed to main DB file BEFORE UI updates
				// This ensures persistence before the updateListener completes
				if (config.checkpoint) {
					await config.checkpoint();
				}
			});

			return results;
		},

		handleDelete: async (mutations) => {
			// Queue the transaction to serialize SQLite operations
			await queueTransaction(async () => {
				await config.drizzle.transaction(async (tx) => {
					for (const mutation of mutations) {
						// biome-ignore lint/suspicious/noExplicitAny: Key is string but table.id is branded type
						await tx.delete(table).where(eq(table.id, mutation.key as any));
					}
				});

				// Checkpoint to ensure WAL is flushed to main DB file
				if (config.checkpoint) {
					await config.checkpoint();
				}
			});
		},
	};

	// Create sync function using shared utilities
	const baseSyncConfig: BaseSyncConfig<TTable> = {
		table,
		readyPromise: config.readyPromise,
		syncMode: config.syncMode,
		debug: config.debug,
	};

	const syncResult = createSyncFunction(baseSyncConfig, backend);

	// Create insert schema with ID default
	// (Other defaults like createdAt/updatedAt are handled by SQLite)
	const schema = createInsertSchemaWithIdDefault(table);

	// Create collection config using shared utilities
	const collectionConfig = createCollectionConfig({
		schema,
		getKey: createGetKeyFunction<TTable>(),
		syncResult,
		onInsert: config.debug
			? async (params) => {
					console.log("onInsert", params);
					// Call the actual handler from syncResult (always defined in createSyncFunction)
					// biome-ignore lint/style/noNonNullAssertion: onInsert is always defined in SyncFunctionResult
					await syncResult.onInsert!(params);
				}
			: undefined,
		onUpdate: config.debug
			? async (params) => {
					console.log("onUpdate", params);
					// Call the actual handler from syncResult (always defined in createSyncFunction)
					// biome-ignore lint/style/noNonNullAssertion: onUpdate is always defined in SyncFunctionResult
					await syncResult.onUpdate!(params);
				}
			: undefined,
		onDelete: config.debug
			? async (params) => {
					console.log("onDelete", params);
					// Call the actual handler from syncResult (always defined in createSyncFunction)
					// biome-ignore lint/style/noNonNullAssertion: onDelete is always defined in SyncFunctionResult
					await syncResult.onDelete!(params);
				}
			: undefined,
		syncMode: config.syncMode,
	});

	return collectionConfig;
}
