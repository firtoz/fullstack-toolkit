import { useState, useMemo, useCallback, useEffect } from "react";
import type { RoutePath } from "@firtoz/router-toolkit";
import { useSearchParams, Link, href } from "react-router";
import {
	DrizzleSqliteProvider,
	useDrizzleSqlite,
} from "@firtoz/drizzle-sqlite-wasm";
import {
	useLiveQuery,
	gt,
	gte,
	lt,
	lte,
	eq,
	and,
	like,
	inArray,
	isNull,
	type InitialQueryBuilder,
	type QueryBuilder,
	type SchemaFromSource,
} from "@tanstack/react-db";
import * as schema from "test-schema/schema";
import migrations from "test-schema/drizzle/migrations";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import { ClientOnly } from "~/components/shared/ClientOnly";
import {
	makeId,
	type InferCollectionFromTable,
	type SQLInterceptor,
	type SQLOperation,
} from "@firtoz/drizzle-utils";
import { todoTable, userTable, type Todo } from "test-schema/schema";

const QueryWithHelper = ({
	helper,
	name,
}: {
	helper: QueryHelper<typeof todoTable, "todo">;
	name: string;
}) => {
	const { useCollection } = useDrizzleSqlite<typeof schema>();

	const todoCollection = useCollection("todoTable");

	const { data: filtered, isLoading } = useLiveQuery(
		(q) => helper(q, todoCollection, "todo"),
		[helper, todoCollection],
	);
	return (
		<div data-testid={`query-with-helper-${name}`}>
			<h4>{name}</h4>
			<div data-testid="query-status">{isLoading ? "Loading..." : "Ready"}</div>
			<div data-testid={`query-count-${name}`}>
				Matching items: {filtered?.length ?? 0}
			</div>
			<div>
				{filtered?.map((todo) => (
					<div key={todo.id} data-testid={`query-todo-${todo.id}`}>
						{todo.title}
					</div>
				))}
			</div>
		</div>
	);
};

import type { Table } from "drizzle-orm";

type QueryHelper<TTable extends Table, TCollectionName extends string> = (
	q: InitialQueryBuilder,
	collection: InferCollectionFromTable<TTable>,
	name: TCollectionName,
) => QueryBuilder<{
	baseSchema: SchemaFromSource<{
		[key in TCollectionName]: InferCollectionFromTable<TTable>;
	}>;
	schema: SchemaFromSource<{
		[key in TCollectionName]: InferCollectionFromTable<TTable>;
	}>;
	fromSourceName: TCollectionName;
	hasJoins: false;
}>;

// const statusQueryHelper = (
// 	q: InitialQueryBuilder,
// 	collection: InferCollectionFromTable<typeof todoTable>,
// 	status: string | null,
// ) => {
// 	if (status === null) return null;
// 	return q.from({ todo: collection }).where(({ todo }) => {
// 		return eq(todo.status, status);
// 	});
// };

// const testQueryHelper: QueryHelper<typeof todoTable, "todo"> = (
// 	q,
// 	collection,
// 	name,
// ) => {
// 	return q.from({ [name]: collection }).where(({ [name]: coll }) => {
// 		return eq(coll.status, "pending");
// 	});
// };

const SqliteSyncModeTestContent = ({
	operations,
	clearOperations,
	syncMode,
}: {
	operations: SQLOperation[];
	clearOperations: () => void;
	syncMode: "eager" | "on-demand";
}) => {
	const { drizzle, readyPromise } = useDrizzleSqlite<typeof schema>();
	const [queryLog, setQueryLog] = useState<string[]>([]);
	const [workerReady, setWorkerReady] = useState(false);

	const [activeQueryHelper, setActiveQueryHelper] = useState<{
		helper: QueryHelper<typeof todoTable, "todo">;
		name: string;
	} | null>(null);
	const [verboseMode, setVerboseMode] = useState(false);

	const addLog = useCallback((message: string) => {
		setQueryLog((prev) => [
			...prev,
			`[${new Date().toISOString()}] ${message}`,
		]);
	}, []);

	const [dbStatus, setDbStatus] = useState<"ready" | "populating" | "clearing">(
		"ready",
	);

	// Wrapper to log status changes
	const setDbStatusWithLog = useCallback(
		(status: "ready" | "populating" | "clearing") => {
			addLog(`DB Status: ${status}`);
			setDbStatus(status);
		},
		[addLog],
	);

	// Wait for database to be ready
	useEffect(() => {
		if (!workerReady) {
			readyPromise.then(() => {
				addLog("SQLite Worker: ready (database initialized)");
				setWorkerReady(true);
			});
		}
	}, [readyPromise, workerReady, addLog]);

	const testTodos = useMemo<
		Omit<Todo, "createdAt" | "updatedAt" | "deletedAt" | "completed">[]
	>(
		() => [
			{
				id: makeId(todoTable, "1"),
				title: "Task 1",
				userId: makeId(userTable, "user1"),
				parentId: null,
				content: "Important task",
				priority: 5,
				status: "pending",
				tags: "work",
			},
			{
				id: makeId(todoTable, "2"),
				title: "Task 2",
				userId: makeId(userTable, "user1"),
				parentId: null,
				content: "Another task",
				priority: 7,
				status: "pending",
				tags: "personal",
			},
			{
				id: makeId(todoTable, "3"),
				title: "Task 3",
				userId: makeId(userTable, "user1"),
				parentId: null,
				content: "High priority",
				priority: 10,
				status: "pending",
				tags: "urgent",
			},
			{
				id: makeId(todoTable, "4"),
				title: "Task 4",
				userId: makeId(userTable, "user1"),
				parentId: null,
				content: "Very high priority",
				priority: 15,
				status: "in-progress",
				tags: "urgent",
			},
			{
				id: makeId(todoTable, "5"),
				title: "Task 5",
				userId: makeId(userTable, "user1"),
				parentId: null,
				content: "Critical",
				priority: 20,
				status: "in-progress",
				tags: "critical",
			},
			{
				id: makeId(todoTable, "6"),
				title: "Task 6",
				userId: makeId(userTable, "user1"),
				parentId: null,
				content: "Medium priority",
				priority: 7,
				status: "done",
				tags: "work",
			},
			{
				id: makeId(todoTable, "7"),
				title: "Task 7",
				userId: makeId(userTable, "user1"),
				parentId: null,
				content: "Low priority",
				priority: 3,
				status: "pending",
				tags: "personal",
			},
		],
		[],
	);

	const populateDB = useCallback(async () => {
		try {
			setDbStatusWithLog("populating");
			addLog("Populating database with test data...");

			// Wait for database to be ready before inserting
			await readyPromise;

			const now = new Date();
			const todosToInsert = testTodos.map((todo) => ({
				...todo,
				completed: false,
				createdAt: now,
				updatedAt: now,
				deletedAt: null,
			}));

			await drizzle.insert(todoTable).values(todosToInsert);

			addLog(`Added ${testTodos.length} items to database`);
			setDbStatusWithLog("ready");
			// In eager mode, collection has cached data - reload to reinitialize
			// In on-demand mode, queries fetch fresh data - no reload needed
			if (syncMode === "eager") {
				window.location.reload();
			}
		} catch (error) {
			console.error(error);
			addLog(
				`ERROR populating database: ${error instanceof Error ? error.message : String(error)}`,
			);
			setDbStatusWithLog("ready"); // Reset status even on error
		}
	}, [readyPromise, drizzle, testTodos, addLog, syncMode, setDbStatusWithLog]);

	const clearDB = useCallback(async () => {
		setDbStatusWithLog("clearing");
		addLog("Clearing database...");

		// Wait for database to be ready before deleting
		await readyPromise;

		await drizzle.delete(todoTable);

		addLog("Database cleared");
		setDbStatusWithLog("ready");
		// In eager mode, collection has cached data - reload to reinitialize
		// In on-demand mode, queries fetch fresh data - no reload needed
		if (syncMode === "eager") {
			window.location.reload();
		}
	}, [readyPromise, drizzle, addLog, syncMode, setDbStatusWithLog]);

	const queryAll = useCallback(() => {
		addLog("Mounting AllItemsQuery component");
		// setActiveQuery({ type: "all" });
		setActiveQueryHelper({
			helper: (q, collection, name) => q.from({ [name]: collection }),
			name: "All Items",
		});
	}, [addLog]);

	const queryPriorityGreaterThan = useCallback(
		(threshold: number) => {
			addLog(`Mounting PriorityQuery component: priority > ${threshold}`);
			// setActiveQuery({ type: "priority", threshold });
			setActiveQueryHelper({
				helper: (q, collection, name) =>
					q.from({ [name]: collection }).where(({ [name]: coll }) => {
						return gt(coll.priority, threshold);
					}),
				name: `Priority > ${threshold}`,
			});
		},
		[addLog],
	);

	const queryStatusEquals = useCallback(
		(status: string) => {
			addLog(`Mounting StatusQuery component: status = ${status}`);
			// setActiveQuery({ type: "status", value: status });
			setActiveQueryHelper({
				helper: (q, collection, name) =>
					q.from({ [name]: collection }).where(({ [name]: coll }) => {
						return eq(coll.status, status);
					}),
				name: `Status = ${status}`,
			});
		},
		[addLog],
	);

	const clearQuery = useCallback(() => {
		addLog("Unmounting query component");
		setActiveQueryHelper(null);
	}, [addLog]);

	const clearLog = useCallback(() => setQueryLog([]), []);

	const queryPriority10 = useCallback(
		() => queryPriorityGreaterThan(10),
		[queryPriorityGreaterThan],
	);
	const queryPriority5 = useCallback(
		() => queryPriorityGreaterThan(5),
		[queryPriorityGreaterThan],
	);
	const queryPriority15 = useCallback(
		() => queryPriorityGreaterThan(15),
		[queryPriorityGreaterThan],
	);

	const queryStatusPending = useCallback(
		() => queryStatusEquals("pending"),
		[queryStatusEquals],
	);
	const queryStatusInProgress = useCallback(
		() => queryStatusEquals("in-progress"),
		[queryStatusEquals],
	);

	// LIKE query
	// Note: TanStack DB doesn't push LIKE queries to the backend (not in SUPPORTED_COLLECTION_FUNCS)
	// so this will always load all data and filter in memory, even in on-demand mode
	const queryLike = useCallback(
		(pattern: string) => {
			addLog(`Mounting LIKE query: content LIKE ${pattern}`);
			setActiveQueryHelper({
				helper: (q, collection, name) =>
					q.from({ [name]: collection }).where(({ [name]: coll }) => {
						return like(coll.content, pattern);
					}),
				name: `Content LIKE "${pattern}"`,
			});
		},
		[addLog],
	);

	// Range query (GTE/LTE)
	const queryRange = useCallback(
		(min: number, max: number) => {
			addLog(`Mounting range query: priority ${min}-${max}`);
			setActiveQueryHelper({
				helper: (q, collection, name) =>
					q.from({ [name]: collection }).where(({ [name]: coll }) => {
						return and(gte(coll.priority, min), lte(coll.priority, max));
					}),
				name: `Priority ${min}-${max} (GTE/LTE)`,
			});
		},
		[addLog],
	);

	// IN array query
	const queryInArray = useCallback(
		(values: string[]) => {
			addLog(`Mounting IN query: status IN [${values.join(", ")}]`);
			setActiveQueryHelper({
				helper: (q, collection, name) =>
					q.from({ [name]: collection }).where(({ [name]: coll }) => {
						return inArray(coll.status, values);
					}),
				name: `Status IN [${values.join(", ")}]`,
			});
		},
		[addLog],
	);

	// Complex AND query
	const queryComplex = useCallback(() => {
		addLog("Mounting complex query: priority > 5 AND status = pending");
		setActiveQueryHelper({
			helper: (q, collection, name) =>
				q.from({ [name]: collection }).where(({ [name]: coll }) => {
					return and(gt(coll.priority, 5), eq(coll.status, "pending"));
				}),
			name: "Priority > 5 AND Status = pending",
		});
	}, [addLog]);

	// LT/LTE query
	const queryLessThan = useCallback(
		(threshold: number) => {
			addLog(`Mounting LT query: priority < ${threshold}`);
			setActiveQueryHelper({
				helper: (q, collection, name) =>
					q.from({ [name]: collection }).where(({ [name]: coll }) => {
						return lt(coll.priority, threshold);
					}),
				name: `Priority < ${threshold}`,
			});
		},
		[addLog],
	);

	// isNull query
	const queryIsNull = useCallback(() => {
		addLog("Mounting isNull query: parentId IS NULL");
		setActiveQueryHelper({
			helper: (q, collection, name) =>
				q.from({ [name]: collection }).where(({ [name]: coll }) => {
					return isNull(coll.parentId);
				}),
			name: "Parent ID IS NULL",
		});
	}, [addLog]);

	const queryLikeTask = useCallback(() => queryLike("%task%"), [queryLike]);
	const queryLikePriority = useCallback(
		() => queryLike("%priority%"),
		[queryLike],
	);
	const queryRange5_15 = useCallback(() => queryRange(5, 15), [queryRange]);
	const queryRange10_20 = useCallback(() => queryRange(10, 20), [queryRange]);
	const queryInArrayActive = useCallback(
		() => queryInArray(["pending", "in-progress"]),
		[queryInArray],
	);
	const queryInArrayDone = useCallback(
		() => queryInArray(["done"]),
		[queryInArray],
	);
	const queryLT10 = useCallback(() => queryLessThan(10), [queryLessThan]);
	const queryLT7 = useCallback(() => queryLessThan(7), [queryLessThan]);

	const toggleVerboseMode = useCallback(
		() => setVerboseMode((prev) => !prev),
		[],
	);

	return (
		<div style={{ padding: "20px", fontFamily: "monospace" }}>
			<h1>SQLite Sync Mode Integration Test</h1>

			<div
				style={{
					marginBottom: "20px",
					padding: "10px",
					background: "#f0f0f0",
				}}
			>
				<div>
					<strong>DB Status:</strong>{" "}
					<span data-testid="db-status">{dbStatus}</span>
				</div>
				<div>
					<strong>Active Query:</strong>{" "}
					{/* {activeQuery?.type === "all" && "All Items"}
					{activeQuery?.type === "priority" &&
						`Priority > ${activeQuery.threshold}`}
					{activeQuery?.type === "status" && `Status = ${activeQuery.value}`} */}
					{/* {!activeQueryHelper && "None"} */}
					{activeQueryHelper ? activeQueryHelper.name : "None"}
				</div>
			</div>

			<div style={{ marginBottom: "20px" }}>
				<h3>Database Setup</h3>
				<button
					type="button"
					onClick={populateDB}
					data-testid="populate-db"
					style={{ marginRight: "10px" }}
				>
					Populate DB (7 items)
				</button>
				<button type="button" onClick={clearDB} data-testid="clear-db">
					Clear DB
				</button>
			</div>

			<div style={{ display: "flex", gap: "20px" }}>
				{/* Left column - Query buttons */}
				<div
					style={{
						flex: "0 0 300px",
						height: "calc(100vh - 300px)",
						overflowY: "auto",
						borderRight: "2px solid #ccc",
						paddingRight: "20px",
					}}
				>
					<h3>Load Query Components</h3>
					<div
						style={{ marginBottom: "10px", fontSize: "12px", color: "#666" }}
					>
						✅ = Optimized (SQL WHERE) | ⚠️ = In-memory filter (loads all data)
					</div>
					<div style={{ marginBottom: "10px" }}>
						<strong>Basic Queries:</strong>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<button
							type="button"
							onClick={queryAll}
							data-testid="query-all"
							style={{ marginRight: "10px" }}
						>
							All Items
						</button>
						<button
							type="button"
							onClick={clearQuery}
							data-testid="clear-query"
						>
							Clear Query
						</button>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<strong>✅ GT (Greater Than):</strong>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<button
							type="button"
							onClick={queryPriority10}
							data-testid="query-priority-gt-10"
							style={{ marginRight: "10px" }}
						>
							priority &gt; 10
						</button>
						<button
							type="button"
							onClick={queryPriority5}
							data-testid="query-priority-gt-5"
							style={{ marginRight: "10px" }}
						>
							priority &gt; 5
						</button>
						<button
							type="button"
							onClick={queryPriority15}
							data-testid="query-priority-gt-15"
						>
							priority &gt; 15
						</button>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<strong>✅ LT (Less Than):</strong>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<button
							type="button"
							onClick={queryLT10}
							data-testid="query-priority-lt-10"
							style={{ marginRight: "10px" }}
						>
							priority &lt; 10
						</button>
						<button
							type="button"
							onClick={queryLT7}
							data-testid="query-priority-lt-7"
						>
							priority &lt; 7
						</button>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<strong>✅ EQ (Equals):</strong>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<button
							type="button"
							onClick={queryStatusPending}
							data-testid="query-status-pending"
							style={{ marginRight: "10px" }}
						>
							status = pending
						</button>
						<button
							type="button"
							onClick={queryStatusInProgress}
							data-testid="query-status-in-progress"
						>
							status = in-progress
						</button>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<strong>⚠️ LIKE (Pattern Matching):</strong>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<button
							type="button"
							onClick={queryLikeTask}
							data-testid="query-like-task"
							style={{ marginRight: "10px" }}
						>
							content LIKE %task%
						</button>
						<button
							type="button"
							onClick={queryLikePriority}
							data-testid="query-like-priority"
						>
							content LIKE %priority%
						</button>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<strong>✅ Range (GTE/LTE):</strong>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<button
							type="button"
							onClick={queryRange5_15}
							data-testid="query-range-5-15"
							style={{ marginRight: "10px" }}
						>
							priority 5-15
						</button>
						<button
							type="button"
							onClick={queryRange10_20}
							data-testid="query-range-10-20"
						>
							priority 10-20
						</button>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<strong>✅ IN Array:</strong>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<button
							type="button"
							onClick={queryInArrayActive}
							data-testid="query-inarray-active"
							style={{ marginRight: "10px" }}
						>
							status IN [pending, in-progress]
						</button>
						<button
							type="button"
							onClick={queryInArrayDone}
							data-testid="query-inarray-done"
						>
							status IN [done]
						</button>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<strong>✅ Complex Queries:</strong>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<button
							type="button"
							onClick={queryComplex}
							data-testid="query-complex-and"
							style={{ marginRight: "10px" }}
						>
							priority &gt; 5 AND status = pending
						</button>
						<button
							type="button"
							onClick={queryIsNull}
							data-testid="query-isnull"
						>
							parentId IS NULL
						</button>
					</div>
				</div>

				{/* Right column - Results and logs */}
				<div style={{ flex: "1", minWidth: 0 }}>
					<div style={{ marginBottom: "20px" }}>
						<h3>Active Query Result</h3>
						<div
							style={{
								border: "1px solid #ccc",
								padding: "10px",
								minHeight: "100px",
								background: "#fff",
							}}
						>
							{/* {activeQuery?.type === "all" && <AllItemsQuery />}
					{activeQuery?.type === "priority" && (
						<PriorityQuery threshold={activeQuery.threshold} />
					)}
					{activeQuery?.type === "status" && (
						<StatusQuery status={activeQuery.value} />
					)}
					{!activeQuery && <div data-testid="no-query">No active query</div>} */}
							{activeQueryHelper ? (
								<QueryWithHelper
									helper={activeQueryHelper.helper}
									name={activeQueryHelper.name}
								/>
							) : (
								<div data-testid="no-query">No active query</div>
							)}
						</div>
					</div>

					<div style={{ marginBottom: "20px" }}>
						<h3>Query Log</h3>
						<button
							type="button"
							onClick={clearLog}
							data-testid="clear-log"
							style={{ marginBottom: "10px" }}
						>
							Clear Log
						</button>
						<div
							data-testid="query-log"
							style={{
								height: "200px",
								overflow: "auto",
								border: "1px solid #ccc",
								padding: "10px",
								background: "#f9f9f9",
							}}
						>
							{queryLog.map((log, i) => (
								<div key={i}>{log}</div>
							))}
						</div>
					</div>

					<div style={{ marginBottom: "20px" }}>
						<h3>SQLite Operations</h3>
						<div style={{ marginBottom: "10px", display: "flex", gap: "10px" }}>
							<button
								type="button"
								onClick={clearOperations}
								data-testid="clear-operations"
							>
								Clear Operations
							</button>
							<button
								type="button"
								onClick={toggleVerboseMode}
								data-testid="toggle-verbose"
								style={{
									background: verboseMode ? "#90EE90" : "#ddd",
								}}
							>
								{verboseMode ? "Hide" : "Show"} Details
							</button>
						</div>
						<div
							data-testid="sql-operations"
							style={{
								height: "300px",
								overflow: "auto",
								border: "1px solid #ccc",
								padding: "10px",
								background: "#e6f3ff",
							}}
						>
							{operations.length === 0 ? (
								<div style={{ color: "#666" }}>No operations yet</div>
							) : (
								operations.map((op, i) => (
									<div
										key={i}
										style={{
											marginBottom: "10px",
											padding: "10px",
											background: "#fff",
											border: "1px solid #ddd",
											borderRadius: "4px",
										}}
										data-operation-type={op.type}
									>
										<div style={{ marginBottom: "5px" }}>
											<strong style={{ fontSize: "14px" }}>{op.type}</strong>
											{"tableName" in op && <> on {op.tableName}</>}
										</div>
										{"context" in op && (
											<div
												style={{
													fontSize: "12px",
													color: "#666",
													marginBottom: "5px",
												}}
											>
												{op.context}
											</div>
										)}
										{(op.type === "select-all" ||
											op.type === "select-where" ||
											op.type === "write") && (
											<div
												style={{
													fontSize: "12px",
													fontWeight: "bold",
													color: op.type === "write" ? "#28a745" : "#0066cc",
												}}
											>
												{op.type === "write"
													? `Written: ${op.writeCount} items`
													: `Returned: ${op.itemCount} items`}
											</div>
										)}
										{verboseMode &&
											(op.type === "select-all" ||
												op.type === "select-where" ||
												op.type === "write") && (
												<details style={{ marginTop: "5px" }}>
													<summary
														style={{ cursor: "pointer", fontSize: "11px" }}
													>
														View items (
														{op.type === "write"
															? op.itemsWritten.length
															: op.itemsReturned.length}
														)
													</summary>
													<pre
														style={{
															fontSize: "10px",
															background: "#f5f5f5",
															padding: "5px",
															marginTop: "5px",
															maxHeight: "200px",
															overflow: "auto",
														}}
													>
														{JSON.stringify(
															op.type === "write"
																? op.itemsWritten
																: op.itemsReturned,
															null,
															2,
														)}
													</pre>
												</details>
											)}
									</div>
								))
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

function sqliteDbNameFromSearchParams(searchParams: URLSearchParams): string {
	const w = searchParams.get("e2eWorker");
	return w !== null && /^\d+$/.test(w)
		? `test-sqlite-sync-mode-w${w}.db`
		: "test-sqlite-sync-mode.db";
}

export default function SqliteSyncModeTest() {
	const [searchParams] = useSearchParams();
	const syncMode =
		(searchParams.get("mode") as "eager" | "on-demand") || "on-demand";
	const e2eWorker = searchParams.get("e2eWorker");
	const dbName = sqliteDbNameFromSearchParams(searchParams);

	// Track SQL operations
	const [operations, setOperations] = useState<SQLOperation[]>([]);

	// Create interceptor to track operations
	const interceptor: SQLInterceptor = useMemo(
		() => ({
			onOperation: (op: SQLOperation) => {
				console.log("[SQLite Interceptor]", op);
				setOperations((prev) => [...prev, op]);
			},
		}),
		[],
	);

	const clearOperations = useCallback(() => setOperations([]), []);

	// Compute toggle URL
	const toggleUrl = useMemo(() => {
		const newMode = syncMode === "eager" ? "on-demand" : "eager";
		const base = `${href("/collections/sqlite-sync-mode-test")}?mode=${newMode}`;
		const workerSuffix =
			e2eWorker !== null && /^\d+$/.test(e2eWorker)
				? `&e2eWorker=${e2eWorker}`
				: "";
		return base + workerSuffix;
	}, [syncMode, e2eWorker]);

	const toggleLabel = useMemo(
		() => (syncMode === "eager" ? "On-Demand" : "Eager"),
		[syncMode],
	);

	return (
		<ClientOnly>
			<div
				style={{
					position: "fixed",
					top: 0,
					right: 0,
					background: syncMode === "eager" ? "#90EE90" : "#87CEEB",
					padding: "10px",
					fontWeight: "bold",
					zIndex: 1000,
					display: "flex",
					flexDirection: "column",
					gap: "10px",
				}}
				data-testid="sync-mode-indicator"
			>
				<div>Mode: {syncMode.toUpperCase()}</div>
				<Link
					to={toggleUrl}
					data-testid="toggle-sync-mode"
					style={{
						padding: "5px 10px",
						cursor: "pointer",
						fontSize: "12px",
						textAlign: "center",
						textDecoration: "none",
						background: "#fff",
						color: "#000",
						border: "1px solid #ccc",
						borderRadius: "3px",
						display: "block",
					}}
					onClick={clearOperations}
				>
					Switch to {toggleLabel}
				</Link>
			</div>
			<DrizzleSqliteProvider
				worker={SqliteWorker}
				dbName={dbName}
				schema={schema}
				migrations={migrations}
				syncMode={syncMode}
				debug={true}
				interceptor={interceptor}
			>
				<SqliteSyncModeTestContent
					operations={operations}
					clearOperations={clearOperations}
					syncMode={syncMode}
				/>
			</DrizzleSqliteProvider>
		</ClientOnly>
	);
}

export const route: RoutePath<"/collections/sqlite-sync-mode-test"> =
	"/collections/sqlite-sync-mode-test";
