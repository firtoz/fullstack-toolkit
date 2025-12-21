import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { RoutePath } from "@firtoz/router-toolkit";
import { useSearchParams } from "react-router";
import {
	DrizzleIndexedDBProvider,
	useDrizzleIndexedDB,
	createInstrumentedDbCreator,
	type IDBOperation,
} from "@firtoz/drizzle-indexeddb";
import { useLiveQuery } from "@tanstack/react-db";
import * as schema from "test-schema/schema";
import { migrations } from "test-schema/drizzle/indexeddb-migrations";
import { ClientOnly } from "~/components/shared/ClientOnly";
import { makeId } from "@firtoz/drizzle-utils";
import { todoTable, userTable, type Todo } from "test-schema/schema";

/**
 * Pagination Test Page
 *
 * This page tests limit/offset pagination with "load more" functionality.
 * It exercises the cursor and offset pagination paths in the collection's loadSubset.
 *
 * Key features tested:
 * - Queries with .limit() to restrict initial results
 * - "Load More" button that triggers offset-based pagination
 * - OrderBy + limit combinations
 * - Cursor-based pagination for sorted results
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
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();
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

	// We request limit + 1 to detect if there are more items
	// If we get exactly itemsToShow items, there might be more
	// If we get less, we've reached the end
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

// Component for testing window/offset-based pagination
const OffsetPaginatedQuery = ({
	pageSize,
	currentPage,
	onPageChange,
}: {
	pageSize: number;
	currentPage: number;
	onPageChange: (page: number) => void;
}) => {
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();
	const todoCollection = useCollection("todoTable");

	// Get total count for pagination
	const { data: allTodos } = useLiveQuery(
		(q) => q.from({ todo: todoCollection }),
		[todoCollection],
	);

	const totalItems = allTodos?.length ?? 0;
	const totalPages = Math.ceil(totalItems / pageSize);
	const offset = currentPage * pageSize;

	const { data: todos, isLoading } = useLiveQuery(
		(q) =>
			q
				.from({ todo: todoCollection })
				.orderBy(({ todo }) => todo.priority, "asc")
				.limit(pageSize),
		[todoCollection, pageSize, currentPage],
	);

	// Apply offset manually since TanStack DB's offset is internal
	// In a real app, you'd use setWindow or similar
	const displayedTodos = useMemo(() => {
		if (!allTodos) return [];
		const sorted = [...allTodos].sort(
			(a, b) => (a.priority ?? 0) - (b.priority ?? 0),
		);
		return sorted.slice(offset, offset + pageSize);
	}, [allTodos, offset, pageSize]);

	return (
		<div data-testid="offset-paginated-query">
			<h4>
				Offset Pagination (page: {currentPage + 1}, size: {pageSize})
			</h4>
			<div data-testid="query-status">{isLoading ? "Loading..." : "Ready"}</div>
			<div data-testid="total-items">Total items: {totalItems}</div>
			<div data-testid="current-offset">Current offset: {offset}</div>
			<div data-testid="items-on-page">
				Items on page: {displayedTodos.length}
			</div>

			<div
				style={{
					marginTop: "10px",
					maxHeight: "200px",
					overflow: "auto",
					border: "1px solid #ddd",
					padding: "10px",
				}}
			>
				{displayedTodos.map((todo, index) => (
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

const PaginationTestContent = ({
	operations,
	clearOperations,
}: {
	operations: IDBOperation[];
	clearOperations: () => void;
}) => {
	const { indexedDB } = useDrizzleIndexedDB<typeof schema>();
	const [dbStatus, setDbStatus] = useState<"ready" | "populating" | "clearing">(
		"ready",
	);
	const [pageSize, setPageSize] = useState(5);
	const [loadMoreCount, setLoadMoreCount] = useState(0);
	const [currentPage, setCurrentPage] = useState(0);
	const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("asc");
	const [activeTest, setActiveTest] = useState<"cursor" | "offset" | null>(
		null,
	);

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
		if (!indexedDB) return;

		setDbStatus("populating");

		const now = new Date();
		const itemsToAdd = testTodos.map((todo) => ({
			...todo,
			completed: false,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		}));

		await indexedDB.add("todo", itemsToAdd);
		setDbStatus("ready");
	}, [indexedDB, testTodos]);

	const clearDB = useCallback(async () => {
		if (!indexedDB) return;

		setDbStatus("clearing");
		await indexedDB.clear("todo");
		setDbStatus("ready");
		setLoadMoreCount(0);
		setCurrentPage(0);
	}, [indexedDB]);

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
			<h1>Pagination Test Page</h1>
			<p style={{ color: "#666", marginBottom: "20px" }}>
				Tests limit/offset pagination with "load more" and page navigation.
			</p>

			<div
				style={{
					marginBottom: "20px",
					padding: "10px",
					background: "#f0f0f0",
					borderRadius: "4px",
				}}
			>
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
						disabled={dbStatus !== "ready"}
					>
						Populate DB (20 items)
					</button>
					<button
						type="button"
						onClick={clearDB}
						data-testid="clear-db"
						disabled={dbStatus !== "ready"}
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
					{!activeTest && (
						<div data-testid="no-test" style={{ color: "#666" }}>
							Select a test mode above
						</div>
					)}
				</div>
			</div>

			{/* Operations Log */}
			<div style={{ marginBottom: "20px" }}>
				<h3>IndexedDB Operations</h3>
				<div
					data-testid="idb-operations"
					style={{
						height: "250px",
						overflow: "auto",
						border: "1px solid #ccc",
						padding: "10px",
						background: "#fff3cd",
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
									background: "#fff",
									border: "1px solid #ddd",
									borderRadius: "4px",
								}}
								data-operation-type={op.type}
								data-operation-index={i}
							>
								<div>
									<strong>{op.type}</strong> on {op.storeName}
								</div>
								{"context" in op && (
									<div style={{ color: "#666" }}>{op.context}</div>
								)}
								{op.type === "index-getAll" && (
									<div style={{ color: "#0066cc" }}>Index: {op.indexName}</div>
								)}
								{(op.type === "getAll" || op.type === "index-getAll") && (
									<div style={{ color: "#0066cc", fontWeight: "bold" }}>
										Returned: {op.itemCount} items
									</div>
								)}
								{op.type === "write" && (
									<div style={{ color: "#28a745", fontWeight: "bold" }}>
										Written: {op.writeCount} items
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

export default function PaginationTest() {
	const [searchParams] = useSearchParams();
	const syncMode =
		(searchParams.get("mode") as "eager" | "on-demand") || "on-demand";

	// Track IDB operations
	const [operations, setOperations] = useState<IDBOperation[]>([]);

	// Create instrumented db creator to track operations
	const dbCreator = useMemo(
		() =>
			createInstrumentedDbCreator({
				onOperation: (op: IDBOperation) => {
					setOperations((prev) => [...prev, op]);
				},
			}),
		[],
	);

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
			<DrizzleIndexedDBProvider
				dbName="test-pagination.db"
				schema={schema}
				migrations={migrations}
				syncMode={syncMode}
				debug={true}
				dbCreator={dbCreator}
			>
				<PaginationTestContent
					operations={operations}
					clearOperations={clearOperations}
				/>
			</DrizzleIndexedDBProvider>
		</ClientOnly>
	);
}

export const route: RoutePath<"/collections/pagination-test"> =
	"/collections/pagination-test";
