import { useState, useEffect, useCallback, useRef } from "react";
import {
	createStandaloneCollection,
	deleteIndexedDB,
} from "@firtoz/drizzle-indexeddb";
import * as schema from "test-schema/schema";
import { migrations } from "test-schema/drizzle/indexeddb-migrations";
import { ClientOnly } from "~/components/shared/ClientOnly";

// Use a simplified type for the UI to avoid branded type issues
interface TodoItem {
	id: string;
	title: string;
	completed: boolean;
	deletedAt: Date | null;
}

const DB_NAME = "standalone-test.db";

// Styles
const styles = {
	container: {
		padding: "20px",
		fontFamily: "system-ui, -apple-system, sans-serif",
		maxWidth: "800px",
		margin: "0 auto",
	},
	header: {
		marginBottom: "24px",
	},
	controls: {
		display: "flex",
		gap: "12px",
		marginBottom: "20px",
		flexWrap: "wrap" as const,
		alignItems: "center",
	},
	button: {
		padding: "8px 16px",
		border: "none",
		borderRadius: "6px",
		cursor: "pointer",
		fontSize: "14px",
		fontWeight: 500,
	},
	primaryButton: {
		background: "#3b82f6",
		color: "white",
	},
	secondaryButton: {
		background: "#e5e7eb",
		color: "#374151",
	},
	dangerButton: {
		background: "#ef4444",
		color: "white",
	},
	card: {
		border: "1px solid #e5e7eb",
		borderRadius: "12px",
		padding: "16px",
		marginBottom: "16px",
		background: "white",
	},
	input: {
		padding: "8px 12px",
		border: "1px solid #d1d5db",
		borderRadius: "6px",
		fontSize: "14px",
		width: "100%",
		marginBottom: "8px",
	},
	todoItem: {
		display: "flex",
		alignItems: "center",
		gap: "12px",
		padding: "8px",
		borderBottom: "1px solid #e5e7eb",
	},
	todoTitle: {
		flex: 1,
	},
	stats: {
		display: "flex",
		gap: "16px",
		marginBottom: "16px",
	},
	stat: {
		padding: "8px 16px",
		background: "#f3f4f6",
		borderRadius: "6px",
	},
	log: {
		fontFamily: "monospace",
		fontSize: "12px",
		background: "#1f2937",
		color: "#10b981",
		padding: "16px",
		borderRadius: "8px",
		maxHeight: "300px",
		overflow: "auto",
		whiteSpace: "pre-wrap" as const,
	},
};

function StandaloneTestContent() {
	// biome-ignore lint/suspicious/noExplicitAny: Complex generic types, runtime is correct
	const [db, setDb] = useState<any>(null);
	const [todos, setTodos] = useState<TodoItem[]>([]);
	const [isReady, setIsReady] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [logs, setLogs] = useState<string[]>([]);
	const logRef = useRef<HTMLDivElement>(null);

	const log = useCallback((message: string) => {
		const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
		setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
	}, []);

	// Auto-scroll logs
	useEffect(() => {
		if (logRef.current) {
			logRef.current.scrollTop = logRef.current.scrollHeight;
		}
	}, [logs]);

	// Initialize the standalone collection
	useEffect(() => {
		log("Creating standalone collection...");

		const collection = createStandaloneCollection({
			dbName: DB_NAME,
			table: schema.todoTable,
			storeName: "todo",
			migrations,
			debug: true,
		});

		setDb(collection);

		// Wait for ready
		collection.ready.then(() => {
			log("Collection is ready!");
			setIsReady(true);
			const items = collection.getAll() as unknown as TodoItem[];
			setTodos(items);
			log(`Loaded ${items.length} existing todos`);
		});

		return () => {
			log("Closing database...");
			collection.close();
		};
	}, [log]);

	// Refresh todos from collection
	const refreshTodos = useCallback(() => {
		if (db) {
			const items = db.getAll() as unknown as TodoItem[];
			setTodos(items);
			log(`Refreshed: ${items.length} todos`);
		}
	}, [db, log]);

	// Add a todo
	const handleAdd = useCallback(async () => {
		if (!db || !newTitle.trim()) return;

		log(`Inserting todo: "${newTitle}"`);
		const tx = await db.insert({
			title: newTitle,
			completed: false,
		});
		log(`Insert complete. Transaction state: ${tx.state}`);
		setNewTitle("");
		refreshTodos();
	}, [db, newTitle, log, refreshTodos]);

	// Toggle completion
	const handleToggle = useCallback(
		async (id: string, currentCompleted: boolean) => {
			if (!db) return;

			log(`Toggling todo ${id} to completed=${!currentCompleted}`);
			await db.update(id, (draft: { completed: boolean }) => {
				draft.completed = !currentCompleted;
			});
			log("Toggle complete");
			refreshTodos();
		},
		[db, log, refreshTodos],
	);

	// Delete a todo
	const handleDelete = useCallback(
		async (id: string) => {
			if (!db) return;

			log(`Deleting todo ${id}`);
			await db.delete(id);
			log("Delete complete");
			refreshTodos();
		},
		[db, log, refreshTodos],
	);

	// Truncate all
	const handleTruncate = useCallback(async () => {
		if (!db) return;

		log("Truncating all todos...");
		await db.truncate();
		log("Truncate complete");
		refreshTodos();
	}, [db, log, refreshTodos]);

	// Reset database
	const handleResetDb = useCallback(async () => {
		if (db) {
			db.close();
		}
		log("Deleting database...");
		await deleteIndexedDB(DB_NAME);
		log("Database deleted. Reload the page to recreate.");
		setDb(null);
		setTodos([]);
		setIsReady(false);
	}, [db, log]);

	// Clear logs
	const clearLogs = useCallback(() => {
		setLogs([]);
	}, []);

	const activeTodos = todos.filter((t) => !t.deletedAt);
	const completedCount = activeTodos.filter((t) => t.completed).length;
	const pendingCount = activeTodos.filter((t) => !t.completed).length;

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<h1>Standalone Collection Test</h1>
				<p>
					Testing <code>createStandaloneCollection</code> outside of React
					context
				</p>
			</div>

			{/* Status */}
			<div style={styles.stats}>
				<div style={styles.stat} data-testid="status">
					Status: <strong>{isReady ? "Ready ✓" : "Loading..."}</strong>
				</div>
				<div style={styles.stat} data-testid="count-total">
					Total: <strong>{activeTodos.length}</strong>
				</div>
				<div style={styles.stat} data-testid="count-pending">
					Pending: <strong>{pendingCount}</strong>
				</div>
				<div style={styles.stat} data-testid="count-done">
					Done: <strong>{completedCount}</strong>
				</div>
			</div>

			{/* Controls */}
			<div style={styles.controls}>
				<button
					type="button"
					style={{ ...styles.button, ...styles.secondaryButton }}
					onClick={refreshTodos}
					disabled={!isReady}
					data-testid="refresh-button"
				>
					Refresh
				</button>
				<button
					type="button"
					style={{ ...styles.button, ...styles.dangerButton }}
					onClick={handleTruncate}
					disabled={!isReady}
					data-testid="truncate-button"
				>
					Truncate All
				</button>
				<button
					type="button"
					style={{ ...styles.button, ...styles.dangerButton }}
					onClick={handleResetDb}
					data-testid="reset-db-button"
				>
					Reset Database
				</button>
				<button
					type="button"
					style={{ ...styles.button, ...styles.secondaryButton }}
					onClick={clearLogs}
					data-testid="clear-logs-button"
				>
					Clear Logs
				</button>
			</div>

			{/* Add Todo Form */}
			<div style={styles.card}>
				<h3>Add Todo</h3>
				<div style={{ display: "flex", gap: "8px" }}>
					<input
						style={{ ...styles.input, flex: 1, marginBottom: 0 }}
						type="text"
						placeholder="Enter todo title..."
						value={newTitle}
						onChange={(e) => setNewTitle(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleAdd()}
						disabled={!isReady}
						data-testid="todo-input"
					/>
					<button
						type="button"
						style={{ ...styles.button, ...styles.primaryButton }}
						onClick={handleAdd}
						disabled={!isReady || !newTitle.trim()}
						data-testid="add-button"
					>
						Add
					</button>
				</div>
			</div>

			{/* Todo List */}
			<div style={styles.card}>
				<h3>Todos</h3>
				{activeTodos.length === 0 ? (
					<p data-testid="empty-state" style={{ color: "#6b7280" }}>
						No todos yet. Add one above!
					</p>
				) : (
					<div data-testid="todo-list">
						{activeTodos.map((todo) => (
							<div
								key={todo.id}
								style={styles.todoItem}
								data-testid={`todo-item-${todo.id}`}
							>
								<button
									type="button"
									style={{
										...styles.button,
										...styles.secondaryButton,
										padding: "4px 8px",
									}}
									onClick={() => handleToggle(todo.id, todo.completed)}
									data-testid={`todo-toggle-${todo.id}`}
								>
									{todo.completed ? "✓" : "○"}
								</button>
								<span
									style={{
										...styles.todoTitle,
										textDecoration: todo.completed ? "line-through" : "none",
										color: todo.completed ? "#9ca3af" : "inherit",
									}}
									data-testid={`todo-title-${todo.id}`}
								>
									{todo.title}
								</span>
								<button
									type="button"
									style={{
										...styles.button,
										...styles.dangerButton,
										padding: "4px 8px",
									}}
									onClick={() => handleDelete(todo.id)}
									data-testid={`todo-delete-${todo.id}`}
								>
									×
								</button>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Logs */}
			<div style={styles.card}>
				<h3>Operation Logs</h3>
				<div style={styles.log} ref={logRef} data-testid="logs">
					{logs.length === 0 ? "No logs yet..." : logs.join("\n")}
				</div>
			</div>
		</div>
	);
}

export default function StandaloneTestRoute() {
	return (
		<ClientOnly>
			<StandaloneTestContent />
		</ClientOnly>
	);
}
