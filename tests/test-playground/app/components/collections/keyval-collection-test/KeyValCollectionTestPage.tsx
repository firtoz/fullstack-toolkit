import { useState, useEffect, useCallback, useMemo } from "react";
import {
	createKeyValCollection,
	type KeyValAdapter,
} from "@firtoz/idb-collections";
import { z } from "zod";

const todoSchema = z.object({
	id: z.string(),
	title: z.string(),
	completed: z.boolean(),
	createdAt: z.number(),
	updatedAt: z.number(),
});

type TodoItem = z.infer<typeof todoSchema>;

const STORE_KEY_PREFIX = "kv-test:";

function createLocalStorageAdapter(): KeyValAdapter<TodoItem> {
	return {
		async get(key) {
			const raw = localStorage.getItem(STORE_KEY_PREFIX + key);
			return raw ? JSON.parse(raw) : null;
		},
		async set(key, value) {
			localStorage.setItem(STORE_KEY_PREFIX + key, JSON.stringify(value));
		},
		async del(key) {
			localStorage.removeItem(STORE_KEY_PREFIX + key);
		},
		async entries() {
			const result: [string, TodoItem][] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const fullKey = localStorage.key(i);
				if (fullKey?.startsWith(STORE_KEY_PREFIX)) {
					const key = fullKey.slice(STORE_KEY_PREFIX.length);
					const raw = localStorage.getItem(fullKey);
					if (raw) {
						result.push([key, JSON.parse(raw)]);
					}
				}
			}
			return result;
		},
		async clear() {
			const keysToRemove: string[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const fullKey = localStorage.key(i);
				if (fullKey?.startsWith(STORE_KEY_PREFIX)) {
					keysToRemove.push(fullKey);
				}
			}
			for (const key of keysToRemove) {
				localStorage.removeItem(key);
			}
		},
	};
}

const styles = {
	container: {
		padding: "20px",
		fontFamily: "system-ui, -apple-system, sans-serif",
		maxWidth: "800px",
		margin: "0 auto",
	},
	header: { marginBottom: "24px" },
	notice: {
		padding: "12px 16px",
		background: "#dbeafe",
		border: "1px solid #3b82f6",
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
	primaryButton: { background: "#3b82f6", color: "white" },
	secondaryButton: { background: "#e5e7eb", color: "#374151" },
	dangerButton: { background: "#ef4444", color: "white" },
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
	todoTitle: { flex: 1 },
	stats: { display: "flex", gap: "16px", marginBottom: "16px" },
	stat: {
		padding: "8px 16px",
		background: "#f3f4f6",
		borderRadius: "6px",
	},
};

export function KeyValCollectionTestPage() {
	const [todos, setTodos] = useState<TodoItem[]>([]);
	const [isReady, setIsReady] = useState(false);
	const [newTitle, setNewTitle] = useState("");

	const collection = useMemo(() => {
		const adapter = createLocalStorageAdapter();
		return createKeyValCollection({
			schema: todoSchema,
			adapter,
			getKey: (item) => item.id,
		});
	}, []);

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

	const completedCount = todos.filter((t) => t.completed).length;
	const pendingCount = todos.length - completedCount;

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<h1>KeyVal Collection Test</h1>
				<p>
					Testing <code>@firtoz/db-helpers</code>{" "}
					<code>createKeyValCollection</code> with a localStorage adapter.
				</p>
			</div>

			<div style={styles.notice} data-testid="keyval-notice">
				<strong>KeyVal + localStorage.</strong> Data persists across page
				refreshes via a simple get/set/del adapter.
			</div>

			<div style={styles.stats}>
				<div style={styles.stat} data-testid="status">
					Status: <strong>{isReady ? "Ready ✓" : "Loading..."}</strong>
				</div>
				<div style={styles.stat} data-testid="count-total">
					Total: <strong>{todos.length}</strong>
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
				{todos.length === 0 ? (
					<p data-testid="empty-state" style={{ color: "#6b7280" }}>
						No todos yet. Add one above!
					</p>
				) : (
					<div data-testid="todo-list">
						{todos.map((todo) => (
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
