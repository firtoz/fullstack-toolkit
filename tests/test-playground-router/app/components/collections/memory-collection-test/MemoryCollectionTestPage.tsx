import { useState, useEffect, useCallback, useMemo } from "react";
import { createMemoryCollection } from "@firtoz/db-helpers";
import { z } from "zod";

const memoryTodoSchema = z.object({
	id: z.string(),
	title: z.string(),
	completed: z.boolean(),
	createdAt: z.number(),
	updatedAt: z.number(),
	deletedAt: z.number().nullable(),
});

type MemoryTodoItem = z.infer<typeof memoryTodoSchema>;

const COLLECTION_ID = "memory-todos";

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
	notice: {
		padding: "12px 16px",
		background: "#fef3c7",
		border: "1px solid #f59e0b",
		borderRadius: "8px",
		marginBottom: "20px",
		fontSize: "14px",
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
};

export function MemoryCollectionTestPage() {
	const [todos, setTodos] = useState<MemoryTodoItem[]>([]);
	const [isReady, setIsReady] = useState(false);
	const [newTitle, setNewTitle] = useState("");

	const collection = useMemo(
		() =>
			createMemoryCollection({
				id: COLLECTION_ID,
				schema: memoryTodoSchema,
				getKey: (item) => item.id,
			}),
		[],
	);

	useEffect(() => {
		const refresh = () => {
			const items = Array.from(collection.values());
			setTodos(items);
		};

		collection.preload().then(
			() => {
				refresh();
				setIsReady(true);
			},
			(error) => {
				console.error("Error preloading collection:", error);
				setIsReady(false);
			},
		);

		const subscription = collection.subscribeChanges(() => {
			refresh();
		});

		return () => {
			subscription.unsubscribe();
		};
	}, [collection]);

	const handleAdd = useCallback(() => {
		if (!newTitle.trim()) return;

		const now = Date.now();
		collection.insert({
			id: crypto.randomUUID(),
			title: newTitle.trim(),
			completed: false,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		});
		setNewTitle("");
	}, [collection, newTitle]);

	const handleToggle = useCallback(
		(id: string, currentCompleted: boolean) => {
			collection.update(id, (draft) => {
				draft.completed = !currentCompleted;
				draft.updatedAt = Date.now();
			});
		},
		[collection],
	);

	const handleDelete = useCallback(
		(id: string) => {
			collection.delete(id);
		},
		[collection],
	);

	const handleTruncate = useCallback(async () => {
		await collection.utils.truncate();
	}, [collection]);

	const activeTodos = todos.filter((t) => t.deletedAt === null);
	const completedCount = activeTodos.filter((t) => t.completed).length;
	const pendingCount = activeTodos.length - completedCount;

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<h1>Memory Collection Test</h1>
				<p>
					Testing <code>@firtoz/db-helpers</code>{" "}
					<code>createMemoryCollection</code>. Data lives only in memory.
				</p>
			</div>

			<div style={styles.notice} data-testid="memory-notice">
				<strong>In-memory only.</strong> Refresh the page and all data vanishes
				— no persistence.
			</div>

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

			<div style={styles.controls}>
				<button
					type="button"
					style={{ ...styles.button, ...styles.dangerButton }}
					onClick={handleTruncate}
					disabled={!isReady}
					data-testid="truncate-button"
				>
					Truncate All
				</button>
			</div>

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
		</div>
	);
}
