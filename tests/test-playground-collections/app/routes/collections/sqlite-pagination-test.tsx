import { useState, useMemo, useCallback, useEffect } from "react";
import type { RoutePath } from "@firtoz/router-toolkit";
import { useSearchParams } from "react-router";
import {
	DrizzleSqliteProvider,
	useDrizzleSqlite,
} from "@firtoz/drizzle-sqlite-wasm";
import { useLiveQuery, count } from "@tanstack/react-db";
import * as schema from "test-schema/schema";
import migrations from "test-schema/drizzle/migrations";
import SqliteWorker from "@firtoz/drizzle-sqlite-wasm/worker/sqlite.worker?worker";
import { ClientOnly } from "~/components/shared/ClientOnly";
import { makeId, type SQLOperation } from "@firtoz/drizzle-utils";
import { todoTable, userTable, type Todo } from "test-schema/schema";

/**
 * SQLite Pagination Test Page
 *
 * This page tests limit/offset pagination with SQLite.
 * Unlike IndexedDB, SQLite supports native LIMIT/OFFSET in SQL,
 * so this should be more efficient.
 *
 * Key features tested:
 * - Queries with .limit() using SQL LIMIT
 * - Offset-based pagination using SQL OFFSET
 * - OrderBy + limit + offset combinations (all in SQL)
 */

// Component for testing paginated query with load more
const PaginatedQuery = ({
	pageSize,
	orderDirection,
	onLoadMore,
	loadMoreCount,
}: {
	pageSize: number;
	orderDirection: "asc" | "desc";
	onLoadMore: () => void;
	loadMoreCount: number;
}) => {
	const { useCollection } = useDrizzleSqlite<typeof schema>();
	const todoCollection = useCollection("todoTable");

	// Calculate total items to show based on load more clicks
	const itemsToShow = pageSize + loadMoreCount * pageSize;

	const { data: todos, isLoading } = useLiveQuery(
		(q) => {
			let query = q.from({ todo: todoCollection });

			// Apply ordering
			query = query.orderBy(({ todo }) => todo.priority, orderDirection);

			// Apply limit
			return query.limit(itemsToShow);
		},
		[todoCollection, itemsToShow, orderDirection],
	);

	const hasMore = todos && todos.length === itemsToShow;

	return (
		<div data-testid="paginated-query">
			<h4>
				Paginated Query (limit: {itemsToShow}, order: {orderDirection})
			</h4>
			<div data-testid="query-status">{isLoading ? "Loading..." : "Ready"}</div>
			<div data-testid="items-shown">Items shown: {todos?.length ?? 0}</div>
			<div data-testid="load-more-count">Load more clicks: {loadMoreCount}</div>

			<div
				style={{
					marginTop: "10px",
					maxHeight: "300px",
					overflow: "auto",
					border: "1px solid #ddd",
					padding: "10px",
				}}
			>
				{todos?.map((todo, index) => (
					<div
						key={todo.id}
						data-testid={`todo-item-${index}`}
						style={{
							padding: "5px",
							borderBottom: "1px solid #eee",
							display: "flex",
							justifyContent: "space-between",
						}}
					>
						<span>
							{index + 1}. {todo.title}
						</span>
						<span style={{ color: "#666" }}>priority: {todo.priority}</span>
					</div>
				))}
			</div>

			{hasMore && (
				<button
					type="button"
					onClick={onLoadMore}
					data-testid="load-more-button"
					style={{
						marginTop: "10px",
						padding: "10px 20px",
						cursor: "pointer",
					}}
				>
					Load More ({pageSize} items)
				</button>
			)}

			{!hasMore && todos && todos.length > 0 && (
				<div
					data-testid="no-more-items"
					style={{ marginTop: "10px", color: "#666" }}
				>
					No more items to load
				</div>
			)}
		</div>
	);
};

// Component for testing REAL SQL OFFSET pagination through TanStack DB API
// Uses useLiveQuery with .offset() to test the collection system properly
// 100% TanStack DB API - no direct Drizzle access!
const OffsetPaginatedQuery = ({
	pageSize,
	currentPage,
	onPageChange,
}: {
	pageSize: number;
	currentPage: number;
	onPageChange: (page: number) => void;
}) => {
	const { useCollection } = useDrizzleSqlite<typeof schema>();
	const todoCollection = useCollection("todoTable");

	const offset = currentPage * pageSize;

	// Get total count using TanStack DB's count() aggregate function
	const { data: countResult } = useLiveQuery(
		(q) => {
			return q
				.from({ todo: todoCollection })
				.select(({ todo }) => ({ total: count(todo.id) }));
		},
		[todoCollection],
	);

	const totalItems = countResult?.[0]?.total ?? 0;
	const totalPages = Math.ceil(totalItems / pageSize);

	// Use TanStack DB's query API with .offset() for pagination
	// This properly tests that our collection system handles offset correctly!
	const { data: todos, isLoading } = useLiveQuery(
		(q) => {
			let query = q.from({ todo: todoCollection });

			// Apply ordering
			query = query.orderBy(({ todo }) => todo.priority, "asc");

			// Apply limit and offset for pagination
			query = query.limit(pageSize);
			if (offset > 0) {
				query = query.offset(offset);
			}

			return query;
		},
		[todoCollection, pageSize, offset],
	);

	return (
		<div data-testid="offset-paginated-query">
			<h4>
				SQL OFFSET via TanStack DB (page: {currentPage + 1}, size: {pageSize})
			</h4>
			<div
				style={{
					background: "#d4edda",
					padding: "8px",
					borderRadius: "4px",
					marginBottom: "10px",
					fontSize: "12px",
				}}
			>
				✅ Using useLiveQuery with .offset({offset}) through collection system
			</div>
			<div data-testid="query-status">{isLoading ? "Loading..." : "Ready"}</div>
			<div data-testid="total-items">Total items: {totalItems}</div>
			<div data-testid="current-offset">Current offset: {offset}</div>
			<div data-testid="items-on-page">Items on page: {todos?.length ?? 0}</div>

			<div
				style={{
					marginTop: "10px",
					maxHeight: "200px",
					overflow: "auto",
					border: "1px solid #ddd",
					padding: "10px",
				}}
			>
				{todos?.map((todo, index) => (
					<div
						key={todo.id}
						data-testid={`offset-todo-item-${index}`}
						style={{
							padding: "5px",
							borderBottom: "1px solid #eee",
							display: "flex",
							justifyContent: "space-between",
						}}
					>
						<span>
							{offset + index + 1}. {todo.title}
						</span>
						<span style={{ color: "#666" }}>priority: {todo.priority}</span>
					</div>
				))}
			</div>

			<div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
				<button
					type="button"
					onClick={() => onPageChange(currentPage - 1)}
					disabled={currentPage === 0}
					data-testid="prev-page-button"
				>
					Previous
				</button>
				<span data-testid="page-indicator">
					Page {currentPage + 1} of {totalPages}
				</span>
				<button
					type="button"
					onClick={() => onPageChange(currentPage + 1)}
					disabled={currentPage >= totalPages - 1}
					data-testid="next-page-button"
				>
					Next
				</button>
			</div>
		</div>
	);
};

// Component for testing count() aggregate function only
const CountOnlyQuery = () => {
	const { useCollection } = useDrizzleSqlite<typeof schema>();
	const todoCollection = useCollection("todoTable");

	const { data: countResult, isLoading } = useLiveQuery(
		(q) =>
			q
				.from({ todo: todoCollection })
				.select(({ todo }) => ({ total: count(todo.id) })),
		[todoCollection],
	);

	const totalItems = countResult?.[0]?.total ?? 0;

	return (
		<div data-testid="count-only-query">
			<h4>Count Only Query</h4>
			<div
				style={{
					background: "#fff3cd",
					padding: "8px",
					borderRadius: "4px",
					marginBottom: "10px",
					fontSize: "12px",
				}}
			>
				🔍 Testing count() aggregate - should generate SELECT COUNT(*)
			</div>
			<div data-testid="query-status">{isLoading ? "Loading..." : "Ready"}</div>
			<div
				data-testid="count-result"
				style={{ fontSize: "24px", margin: "20px 0" }}
			>
				Total items: <strong>{totalItems}</strong>
			</div>
			<div style={{ color: "#666", fontSize: "12px" }}>
				Check the SQL Operations log below to see the generated COUNT(*) query
			</div>
		</div>
	);
};

const SQLitePaginationTestContent = ({
	operations,
	clearOperations,
}: {
	operations: SQLOperation[];
	clearOperations: () => void;
}) => {
	const { drizzle, readyPromise } = useDrizzleSqlite<typeof schema>();
	const [workerReady, setWorkerReady] = useState(false);
	const [dbStatus, setDbStatus] = useState<"ready" | "populating" | "clearing">(
		"ready",
	);
	const [pageSize, setPageSize] = useState(5);
	const [loadMoreCount, setLoadMoreCount] = useState(0);
	const [currentPage, setCurrentPage] = useState(0);
	const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("asc");
	const [activeTest, setActiveTest] = useState<
		"cursor" | "offset" | "count" | null
	>(null);

	// Wait for database worker to be ready
	useEffect(() => {
		if (!workerReady) {
			readyPromise.then(() => {
				setWorkerReady(true);
			});
		}
	}, [readyPromise, workerReady]);

	// Generate 20 test items with varying priorities
	const testTodos = useMemo<
		Omit<Todo, "createdAt" | "updatedAt" | "deletedAt" | "completed">[]
	>(() => {
		const items: Omit<
			Todo,
			"createdAt" | "updatedAt" | "deletedAt" | "completed"
		>[] = [];
		for (let i = 1; i <= 20; i++) {
			items.push({
				id: makeId(todoTable, `pagination-${i}`),
				title: `Task ${i}`,
				userId: makeId(userTable, "user1"),
				parentId: null,
				content: `Content for task ${i}`,
				priority: i, // Priority 1-20
				status: i % 3 === 0 ? "done" : i % 2 === 0 ? "in-progress" : "pending",
				tags: `tag-${i % 5}`,
			});
		}
		return items;
	}, []);

	const populateDB = useCallback(async () => {
		if (!drizzle) return;

		setDbStatus("populating");

		// Wait for database to be ready before inserting
		await readyPromise;

		const now = new Date();
		const itemsToAdd = testTodos.map((todo) => ({
			...todo,
			completed: false,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		}));

		await drizzle.insert(todoTable).values(itemsToAdd);
		setDbStatus("ready");
	}, [readyPromise, drizzle, testTodos]);

	const clearDB = useCallback(async () => {
		if (!drizzle) return;

		setDbStatus("clearing");

		// Wait for database to be ready before deleting
		await readyPromise;

		await drizzle.delete(todoTable);
		setDbStatus("ready");
		setLoadMoreCount(0);
		setCurrentPage(0);
	}, [readyPromise, drizzle]);

	const handleLoadMore = useCallback(() => {
		setLoadMoreCount((prev) => prev + 1);
	}, []);

	const handlePageChange = useCallback((page: number) => {
		setCurrentPage(page);
	}, []);

	const resetPagination = useCallback(() => {
		setLoadMoreCount(0);
		setCurrentPage(0);
	}, []);

	return (
		<div style={{ padding: "20px", fontFamily: "monospace" }}>
			<h1>SQLite Pagination Test Page</h1>
			<p style={{ color: "#666", marginBottom: "20px" }}>
				Tests limit/offset pagination with SQLite. Unlike IndexedDB, SQLite uses
				native SQL LIMIT/OFFSET.
			</p>

			<div
				style={{
					marginBottom: "20px",
					padding: "10px",
					background: "#e6f3ff",
					borderRadius: "4px",
					border: "1px solid #0066cc",
				}}
			>
				<div style={{ fontWeight: "bold", marginBottom: "5px" }}>
					⚡ SQLite Advantage
				</div>
				<div style={{ fontSize: "12px" }}>
					SQLite uses native SQL LIMIT/OFFSET clauses, so it only fetches the
					requested rows instead of loading everything into memory like
					IndexedDB.
				</div>
			</div>

			<div
				style={{
					marginBottom: "20px",
					padding: "10px",
					background: "#f0f0f0",
					borderRadius: "4px",
				}}
			>
				<div>
					<strong>Worker Status:</strong>{" "}
					<span data-testid="worker-status">
						{workerReady ? "ready" : "initializing"}
					</span>
				</div>
				<div>
					<strong>DB Status:</strong>{" "}
					<span data-testid="db-status">{dbStatus}</span>
				</div>
				<div>
					<strong>Page Size:</strong> {pageSize}
				</div>
				<div>
					<strong>Order:</strong> {orderDirection}
				</div>
			</div>

			{/* Database Controls */}
			<div style={{ marginBottom: "20px" }}>
				<h3>Database Setup</h3>
				<div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
					<button
						type="button"
						onClick={populateDB}
						data-testid="populate-db"
						disabled={!workerReady || dbStatus !== "ready"}
					>
						Populate DB (20 items)
					</button>
					<button
						type="button"
						onClick={clearDB}
						data-testid="clear-db"
						disabled={!workerReady || dbStatus !== "ready"}
					>
						Clear DB
					</button>
					<button
						type="button"
						onClick={clearOperations}
						data-testid="clear-operations"
					>
						Clear Operations Log
					</button>
				</div>
			</div>

			{/* Pagination Controls */}
			<div style={{ marginBottom: "20px" }}>
				<h3>Pagination Settings</h3>
				<div
					style={{
						display: "flex",
						gap: "20px",
						alignItems: "center",
						flexWrap: "wrap",
					}}
				>
					<label>
						Page Size:{" "}
						<select
							value={pageSize}
							onChange={(e) => {
								setPageSize(Number(e.target.value));
								resetPagination();
							}}
							data-testid="page-size-select"
						>
							<option value={3}>3</option>
							<option value={5}>5</option>
							<option value={10}>10</option>
						</select>
					</label>
					<label>
						Order:{" "}
						<select
							value={orderDirection}
							onChange={(e) => {
								setOrderDirection(e.target.value as "asc" | "desc");
								resetPagination();
							}}
							data-testid="order-select"
						>
							<option value="asc">Ascending (priority)</option>
							<option value="desc">Descending (priority)</option>
						</select>
					</label>
					<button
						type="button"
						onClick={resetPagination}
						data-testid="reset-pagination"
					>
						Reset Pagination
					</button>
				</div>
			</div>

			{/* Test Selection */}
			<div style={{ marginBottom: "20px" }}>
				<h3>Test Mode</h3>
				<div style={{ display: "flex", gap: "10px" }}>
					<button
						type="button"
						onClick={() => {
							setActiveTest("cursor");
							resetPagination();
						}}
						data-testid="test-cursor-pagination"
						style={{
							background: activeTest === "cursor" ? "#90EE90" : undefined,
						}}
					>
						Cursor/Load More Pagination
					</button>
					<button
						type="button"
						onClick={() => {
							setActiveTest("offset");
							resetPagination();
						}}
						data-testid="test-offset-pagination"
						style={{
							background: activeTest === "offset" ? "#90EE90" : undefined,
						}}
					>
						Offset/Page Navigation
					</button>
					<button
						type="button"
						onClick={() => {
							setActiveTest("count");
						}}
						data-testid="test-count-only"
						style={{
							background: activeTest === "count" ? "#FFD700" : undefined,
						}}
					>
						Count Only
					</button>
					<button
						type="button"
						onClick={() => setActiveTest(null)}
						data-testid="clear-test"
					>
						Clear
					</button>
				</div>
			</div>

			{/* Active Test */}
			<div style={{ marginBottom: "20px" }}>
				<h3>Active Test</h3>
				<div
					style={{
						border: "1px solid #ccc",
						padding: "15px",
						minHeight: "200px",
						background: "#fff",
					}}
				>
					{activeTest === "cursor" && (
						<PaginatedQuery
							pageSize={pageSize}
							orderDirection={orderDirection}
							onLoadMore={handleLoadMore}
							loadMoreCount={loadMoreCount}
						/>
					)}
					{activeTest === "offset" && (
						<OffsetPaginatedQuery
							pageSize={pageSize}
							currentPage={currentPage}
							onPageChange={handlePageChange}
						/>
					)}
					{activeTest === "count" && <CountOnlyQuery />}
					{!activeTest && (
						<div data-testid="no-test" style={{ color: "#666" }}>
							Select a test mode above
						</div>
					)}
				</div>
			</div>

			{/* Operations Log */}
			<div style={{ marginBottom: "20px" }}>
				<h3>SQLite Operations</h3>
				<div
					data-testid="sql-operations"
					style={{
						height: "250px",
						overflow: "auto",
						border: "1px solid #ccc",
						padding: "10px",
						background: "#e6f3ff",
						fontSize: "12px",
					}}
				>
					{operations.length === 0 ? (
						<div style={{ color: "#666" }}>No operations yet</div>
					) : (
						operations.map((op, i) => (
							<div
								key={i}
								style={{
									marginBottom: "8px",
									padding: "8px",
									background: op.type === "raw-query" ? "#fff3cd" : "#fff",
									border: "1px solid #ddd",
									borderRadius: "4px",
								}}
								data-operation-type={op.type}
								data-operation-index={i}
							>
								<div>
									<strong>{op.type}</strong>
									{op.type !== "raw-query" && ` on ${op.tableName}`}
								</div>
								{"context" in op && (
									<div style={{ color: "#666" }}>{op.context}</div>
								)}
								{op.type === "raw-query" && (
									<>
										<div style={{ color: "#0066cc", fontWeight: "bold" }}>
											Rows: {op.rowCount}
										</div>
										<div
											style={{
												fontSize: "10px",
												color: "#888",
												wordBreak: "break-all",
												marginTop: "4px",
											}}
										>
											SQL: {op.sql}
										</div>
										{op.params && op.params.length > 0 && (
											<div
												style={{
													fontSize: "10px",
													color: "#666",
													wordBreak: "break-all",
													marginTop: "2px",
												}}
											>
												Params: [{op.params.map(String).join(", ")}]
											</div>
										)}
									</>
								)}
								{op.type !== "raw-query" && "itemCount" in op && (
									<div style={{ color: "#0066cc", fontWeight: "bold" }}>
										Returned: {op.itemCount} items
									</div>
								)}
							</div>
						))
					)}
				</div>
				<div
					data-testid="operation-count"
					style={{ marginTop: "5px", fontSize: "12px" }}
				>
					Total operations: {operations.length}
				</div>
			</div>
		</div>
	);
};

function sqlitePaginationDbNameFromSearchParams(
	searchParams: URLSearchParams,
): string {
	const w = searchParams.get("e2eWorker");
	return w !== null && /^\d+$/.test(w)
		? `test-sqlite-pagination-w${w}.db`
		: "test-sqlite-pagination.db";
}

export default function SQLitePaginationTest() {
	const [searchParams] = useSearchParams();
	const syncMode =
		(searchParams.get("mode") as "eager" | "on-demand") || "on-demand";
	const dbName = sqlitePaginationDbNameFromSearchParams(searchParams);

	// Track SQL operations
	const [operations, setOperations] = useState<SQLOperation[]>([]);

	const handleOperation = useCallback((op: SQLOperation) => {
		setOperations((prev) => [...prev, op]);
	}, []);

	const clearOperations = useCallback(() => setOperations([]), []);

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
				}}
				data-testid="sync-mode-indicator"
			>
				Mode: {syncMode.toUpperCase()}
			</div>
			<DrizzleSqliteProvider
				worker={SqliteWorker}
				dbName={dbName}
				schema={schema}
				migrations={migrations}
				syncMode={syncMode}
				debug={true}
				interceptor={{
					onOperation: handleOperation,
				}}
			>
				<SQLitePaginationTestContent
					operations={operations}
					clearOperations={clearOperations}
				/>
			</DrizzleSqliteProvider>
		</ClientOnly>
	);
}

export const route: RoutePath<"/collections/sqlite-pagination-test"> =
	"/collections/sqlite-pagination-test";
