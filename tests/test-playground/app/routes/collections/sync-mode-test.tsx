import { useState, useMemo, useCallback } from "react";
import type { RoutePath } from "@firtoz/router-toolkit";
import { useSearchParams, Link, href } from "react-router";
import {
	DrizzleIndexedDBProvider,
	useDrizzleIndexedDB,
	type IDBInterceptor,
	type IDBOperation,
} from "@firtoz/drizzle-indexeddb";
import {
	useLiveQuery,
	gt,
	gte,
	lte,
	eq,
	and,
	like,
	inArray,
} from "@tanstack/react-db";
import * as schema from "test-schema/schema";
import { migrations } from "test-schema/drizzle/indexeddb-migrations";
import { ClientOnly } from "~/components/shared/ClientOnly";
import { makeId } from "@firtoz/drizzle-utils";
import { todoTable, userTable, type Todo } from "test-schema/schema";

// Component for testing "all items" query
const AllItemsQuery = () => {
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();
	const todoCollection = useCollection("todoTable");

	const { data: allTodos, isLoading } = useLiveQuery((q) =>
		q.from({ todo: todoCollection }),
	);

	return (
		<div data-testid="all-items-query">
			<h4>All Items Query</h4>
			<div data-testid="query-status">{isLoading ? "Loading..." : "Ready"}</div>
			<div data-testid="all-items-count">
				Items in memory: {allTodos?.length ?? 0}
			</div>
			<div>
				{allTodos?.map((todo) => (
					<div key={todo.id} data-testid={`all-todo-${todo.id}`}>
						{todo.title}
					</div>
				))}
			</div>
		</div>
	);
};

// Component for testing priority > N queries
const PriorityQuery = ({ threshold }: { threshold: number | null }) => {
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();
	const todoCollection = useCollection("todoTable");

	const { data: filtered, isLoading } = useLiveQuery(
		(q) => {
			if (threshold === null) return null;
			return q.from({ todo: todoCollection }).where(({ todo }) => {
				return gt(todo.priority, threshold);
			});
		},
		[threshold, todoCollection],
	);

	if (threshold === null) return null;

	return (
		<div data-testid={`priority-query-gt-${threshold}`}>
			<h4>Priority &gt; {threshold} Query</h4>
			<div data-testid="query-status">{isLoading ? "Loading..." : "Ready"}</div>
			<div data-testid={`priority-count-${threshold}`}>
				Matching items: {filtered?.length ?? 0}
			</div>
			<div>
				{filtered?.map((todo) => (
					<div key={todo.id} data-testid={`priority-todo-${todo.id}`}>
						{todo.title} (priority: {todo.priority})
					</div>
				))}
			</div>
		</div>
	);
};

// Component for testing status = X queries
const StatusQuery = ({ status }: { status: string | null }) => {
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();
	const todoCollection = useCollection("todoTable");

	const { data: filtered, isLoading } = useLiveQuery(
		(q) => {
			if (status === null) return null;
			return q.from({ todo: todoCollection }).where(({ todo }) => {
				return eq(todo.status, status);
			});
		},
		[status, todoCollection],
	);

	if (status === null) return null;

	return (
		<div data-testid={`status-query-${status}`}>
			<h4>Status = {status} Query</h4>
			<div data-testid="query-status">{isLoading ? "Loading..." : "Ready"}</div>
			<div data-testid={`status-count-${status}`}>
				Matching items: {filtered?.length ?? 0}
			</div>
			<div>
				{filtered?.map((todo) => (
					<div key={todo.id} data-testid={`status-todo-${todo.id}`}>
						{todo.title} (status: {todo.status})
					</div>
				))}
			</div>
		</div>
	);
};

// Component for testing LIKE queries
const LikeQuery = ({ pattern }: { pattern: string | null }) => {
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();
	const todoCollection = useCollection("todoTable");

	const { data: filtered, isLoading } = useLiveQuery(
		(q) => {
			if (pattern === null) return null;
			return q.from({ todo: todoCollection }).where(({ todo }) => {
				return like(todo.content, pattern);
			});
		},
		[pattern, todoCollection],
	);

	if (pattern === null) return null;

	return (
		<div data-testid={`like-query-${pattern}`}>
			<h4>Content LIKE "{pattern}" Query</h4>
			<div data-testid="query-status">{isLoading ? "Loading..." : "Ready"}</div>
			<div data-testid={`like-count-${pattern}`}>
				Matching items: {filtered?.length ?? 0}
			</div>
			<div>
				{filtered?.map((todo) => (
					<div key={todo.id} data-testid={`like-todo-${todo.id}`}>
						{todo.title} - {todo.content}
					</div>
				))}
			</div>
		</div>
	);
};

// Component for testing range queries (GTE/LTE)
const RangeQuery = ({
	min,
	max,
}: {
	min: number | null;
	max: number | null;
}) => {
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();
	const todoCollection = useCollection("todoTable");

	const { data: filtered, isLoading } = useLiveQuery(
		(q) => {
			if (min === null || max === null) return null;
			return q.from({ todo: todoCollection }).where(({ todo }) => {
				return and(gte(todo.priority, min), lte(todo.priority, max));
			});
		},
		[min, max, todoCollection],
	);

	if (min === null || max === null) return null;

	return (
		<div data-testid={`range-query-${min}-${max}`}>
			<h4>
				Priority {min} - {max} Query (GTE/LTE)
			</h4>
			<div data-testid="query-status">{isLoading ? "Loading..." : "Ready"}</div>
			<div data-testid={`range-count-${min}-${max}`}>
				Matching items: {filtered?.length ?? 0}
			</div>
			<div>
				{filtered?.map((todo) => (
					<div key={todo.id} data-testid={`range-todo-${todo.id}`}>
						{todo.title} (priority: {todo.priority})
					</div>
				))}
			</div>
		</div>
	);
};

// Component for testing IN array queries
const InArrayQuery = ({ values }: { values: string[] | null }) => {
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();
	const todoCollection = useCollection("todoTable");

	const { data: filtered, isLoading } = useLiveQuery(
		(q) => {
			if (!values || values.length === 0) return null;
			return q.from({ todo: todoCollection }).where(({ todo }) => {
				return inArray(todo.status, values);
			});
		},
		[values, todoCollection],
	);

	if (!values || values.length === 0) return null;

	return (
		<div data-testid="inarray-query">
			<h4>Status IN [{values.join(", ")}] Query</h4>
			<div data-testid="query-status">{isLoading ? "Loading..." : "Ready"}</div>
			<div data-testid="inarray-count">
				Matching items: {filtered?.length ?? 0}
			</div>
			<div>
				{filtered?.map((todo) => (
					<div key={todo.id} data-testid={`inarray-todo-${todo.id}`}>
						{todo.title} (status: {todo.status})
					</div>
				))}
			</div>
		</div>
	);
};

const SyncModeTestContent = ({
	operations,
	clearOperations,
	syncMode,
}: {
	operations: IDBOperation[];
	clearOperations: () => void;
	syncMode: "eager" | "on-demand";
}) => {
	const { indexedDB } = useDrizzleIndexedDB<typeof schema>();
	const [queryLog, setQueryLog] = useState<string[]>([]);
	const [activeQuery, setActiveQuery] = useState<
		| { type: "all" }
		| { type: "priority"; threshold: number }
		| { type: "status"; value: string }
		| { type: "like"; pattern: string }
		| { type: "range"; min: number; max: number }
		| { type: "inarray"; values: string[] }
		| null
	>(null);
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
		if (!indexedDB) return;

		setDbStatusWithLog("populating");
		addLog("Populating database with test data...");

		const now = new Date();
		const itemsToAdd = testTodos.map((todo) => ({
			...todo,
			completed: false,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		}));

		await indexedDB.add("todo", itemsToAdd);

		addLog(`Added ${testTodos.length} items to database`);
		setDbStatusWithLog("ready");
		// In eager mode, collection has cached data - reload to reinitialize
		// In on-demand mode, queries fetch fresh data - no reload needed
		if (syncMode === "eager") {
			window.location.reload();
		}
	}, [indexedDB, testTodos, addLog, syncMode, setDbStatusWithLog]);

	const clearDB = useCallback(async () => {
		if (!indexedDB) return;

		setDbStatusWithLog("clearing");
		addLog("Clearing database...");

		await indexedDB.clear("todo");

		addLog("Database cleared");
		setDbStatusWithLog("ready");
		// In eager mode, collection has cached data - reload to reinitialize
		// In on-demand mode, queries fetch fresh data - no reload needed
		if (syncMode === "eager") {
			window.location.reload();
		}
	}, [indexedDB, addLog, syncMode, setDbStatusWithLog]);

	const queryAll = useCallback(() => {
		addLog("Mounting AllItemsQuery component");
		setActiveQuery({ type: "all" });
	}, [addLog]);

	const queryPriorityGreaterThan = useCallback(
		(threshold: number) => {
			addLog(`Mounting PriorityQuery component: priority > ${threshold}`);
			setActiveQuery({ type: "priority", threshold });
		},
		[addLog],
	);

	const queryStatusEquals = useCallback(
		(status: string) => {
			addLog(`Mounting StatusQuery component: status = ${status}`);
			setActiveQuery({ type: "status", value: status });
		},
		[addLog],
	);

	const clearQuery = useCallback(() => {
		addLog("Unmounting query component");
		setActiveQuery(null);
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

	// Note: TanStack DB doesn't push LIKE queries to the backend (not in SUPPORTED_COLLECTION_FUNCS)
	// so this will always load all data and filter in memory, even in on-demand mode
	const queryLike = useCallback(
		(pattern: string) => {
			addLog(`Querying content LIKE ${pattern}`);
			setActiveQuery({ type: "like", pattern });
		},
		[addLog],
	);

	const queryRange = useCallback(
		(min: number, max: number) => {
			addLog(`Querying priority ${min}-${max}`);
			setActiveQuery({ type: "range", min, max });
		},
		[addLog],
	);

	const queryInArray = useCallback(
		(values: string[]) => {
			addLog(`Querying status IN [${values.join(", ")}]`);
			setActiveQuery({ type: "inarray", values });
		},
		[addLog],
	);

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

	const toggleVerboseMode = useCallback(
		() => setVerboseMode((prev) => !prev),
		[],
	);

	return (
		<div style={{ padding: "20px", fontFamily: "monospace" }}>
			<h1>Sync Mode Integration Test</h1>

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
					{activeQuery?.type === "all" && "All Items"}
					{activeQuery?.type === "priority" &&
						`Priority > ${activeQuery.threshold}`}
					{activeQuery?.type === "status" && `Status = ${activeQuery.value}`}
					{activeQuery?.type === "like" &&
						`Content LIKE "${activeQuery.pattern}"`}
					{activeQuery?.type === "range" &&
						`Priority ${activeQuery.min}-${activeQuery.max}`}
					{activeQuery?.type === "inarray" &&
						`Status IN [${activeQuery.values.join(", ")}]`}
					{!activeQuery && "None"}
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

			<div style={{ marginBottom: "20px" }}>
				<h3>Load Query Components</h3>
				<div style={{ marginBottom: "10px", fontSize: "12px", color: "#666" }}>
					✅ = Optimized (pushed to backend) | ⚠️ = In-memory filter (loads all
					data)
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
					<button type="button" onClick={clearQuery} data-testid="clear-query">
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
						{activeQuery?.type === "all" && <AllItemsQuery />}
						{activeQuery?.type === "priority" && (
							<PriorityQuery threshold={activeQuery.threshold} />
						)}
						{activeQuery?.type === "status" && (
							<StatusQuery status={activeQuery.value} />
						)}
						{activeQuery?.type === "like" && (
							<LikeQuery pattern={activeQuery.pattern} />
						)}
						{activeQuery?.type === "range" && (
							<RangeQuery min={activeQuery.min} max={activeQuery.max} />
						)}
						{activeQuery?.type === "inarray" && (
							<InArrayQuery values={activeQuery.values} />
						)}
						{!activeQuery && <div data-testid="no-query">No active query</div>}
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
					<h3>IndexedDB Operations</h3>
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
						data-testid="idb-operations"
						style={{
							height: "300px",
							overflow: "auto",
							border: "1px solid #ccc",
							padding: "10px",
							background: "#fff3cd",
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
										<strong style={{ fontSize: "14px" }}>{op.type}</strong> on{" "}
										{op.storeName}
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
									{op.type === "index-getAll" && (
										<div style={{ fontSize: "12px", color: "#0066cc" }}>
											Index: {op.indexName}
										</div>
									)}
									{(op.type === "getAll" ||
										op.type === "index-getAll" ||
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
										(op.type === "getAll" ||
											op.type === "index-getAll" ||
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
	);
};

export default function SyncModeTest() {
	const [searchParams] = useSearchParams();
	const syncMode =
		(searchParams.get("mode") as "eager" | "on-demand") || "on-demand";

	// Track IDB operations
	const [operations, setOperations] = useState<IDBOperation[]>([]);

	// Create interceptor to track operations
	const interceptor: IDBInterceptor = useMemo(
		() => ({
			onOperation: (op: IDBOperation) => {
				setOperations((prev) => [...prev, op]);
			},
		}),
		[],
	);

	const clearOperations = useCallback(() => setOperations([]), []);

	// Compute toggle URL
	const toggleUrl = useMemo(() => {
		const newMode = syncMode === "eager" ? "on-demand" : "eager";
		return `${href("/collections/sync-mode-test")}?mode=${newMode}`;
	}, [syncMode]);

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
					background: syncMode === "eager" ? "#90EE90" : "#FFD700",
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
			<DrizzleIndexedDBProvider
				dbName="test-sync-mode.db"
				schema={schema}
				migrations={migrations}
				syncMode={syncMode}
				debug={true}
				interceptor={interceptor}
			>
				<SyncModeTestContent
					operations={operations}
					clearOperations={clearOperations}
					syncMode={syncMode}
				/>
			</DrizzleIndexedDBProvider>
		</ClientOnly>
	);
}

export const route: RoutePath<"/collections/sync-mode-test"> =
	"/collections/sync-mode-test";
