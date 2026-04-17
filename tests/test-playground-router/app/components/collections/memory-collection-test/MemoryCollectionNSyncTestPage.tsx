import { useState, useEffect, useCallback, useRef } from "react";
import {
	createMemoryCollection,
	type MemoryCollection,
	type SyncMessage,
} from "@firtoz/db-helpers";
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

const MIN_N = 1;
const MAX_N = 8;
const INITIAL_N = 2;

const styles = {
	container: {
		padding: "20px",
		fontFamily: "system-ui, -apple-system, sans-serif",
		maxWidth: "1200px",
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
	grid: {
		display: "grid",
		gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
		gap: "16px",
	},
	panel: {
		border: "2px solid #e5e7eb",
		borderRadius: "12px",
		padding: "16px",
		background: "#fafafa",
	},
	panelTitle: { marginBottom: "12px", fontSize: "16px", fontWeight: 600 },
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
		gap: "8px",
		padding: "6px 0",
		borderBottom: "1px solid #e5e7eb",
	},
	todoTitle: { flex: 1, fontSize: "14px" },
	smallButton: {
		padding: "4px 8px",
		border: "none",
		borderRadius: "4px",
		cursor: "pointer",
		fontSize: "12px",
	},
};

type CollectionsRef = React.MutableRefObject<
	(MemoryCollection<typeof memoryTodoSchema> | null)[]
>;

function SingleCollectionPanel({
	index,
	collectionsRef,
}: {
	index: number;
	collectionsRef: CollectionsRef;
}) {
	const [collection, setCollection] = useState<MemoryCollection<
		typeof memoryTodoSchema
	> | null>(null);
	const [todos, setTodos] = useState<MemoryTodoItem[]>([]);
	const [isReady, setIsReady] = useState(false);
	const [newTitle, setNewTitle] = useState("");

	// Isolated mount: create this panel's collection and register for broadcast
	useEffect(() => {
		const col = createMemoryCollection({
			id: `memory-todos-sync-${index}`,
			schema: memoryTodoSchema,
			getKey: (item) => item.id,
			onBroadcast: (
				changes: SyncMessage<MemoryTodoItem, string | number>[],
			) => {
				collectionsRef.current.forEach((c, j) => {
					if (c && j !== index) c.utils.receiveSync(changes);
				});
			},
		});

		collectionsRef.current[index] = col;
		setCollection(col);

		return () => {
			collectionsRef.current[index] = null;
		};
	}, [index, collectionsRef]);

	const hasInitialSyncedRef = useRef(false);

	useEffect(() => {
		if (!collection) return;

		const refresh = () => {
			setTodos(Array.from(collection.values()));
		};

		collection.preload().then(
			() => {
				refresh();
				setIsReady(true);
				// Initial sync from first collection after sync layer is ready (syncParams set)
				if (index > 0 && !hasInitialSyncedRef.current) {
					hasInitialSyncedRef.current = true;
					const source = collectionsRef.current[0];
					if (source) {
						const items = Array.from(source.values());
						if (items.length > 0) {
							const inserts: SyncMessage<MemoryTodoItem, string | number>[] =
								items.map((item) => ({ type: "insert", value: item }));
							void collection.utils.receiveSync(inserts);
						}
					}
				}
			},
			(err) => {
				console.error(err);
				setIsReady(false);
			},
		);

		let rafId: number | null = null;
		const sub = collection.subscribeChanges((changes) => {
			if (changes.length === 0) return;
			if (rafId !== null) return;
			rafId = requestAnimationFrame(() => {
				rafId = null;
				refresh();
			});
		});
		return () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
			sub.unsubscribe();
		};
	}, [collection, index, collectionsRef]);

	const handleAdd = useCallback(() => {
		if (!collection || !newTitle.trim()) return;
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
		(id: string, completed: boolean) => {
			collection?.update(id, (draft) => {
				draft.completed = !completed;
				draft.updatedAt = Date.now();
			});
		},
		[collection],
	);

	const handleDelete = useCallback(
		(id: string) => {
			collection?.delete(id);
		},
		[collection],
	);

	const activeTodos = todos.filter((t) => t.deletedAt === null);

	if (!collection) {
		return (
			<div style={styles.panel}>
				<div style={styles.panelTitle}>Collection {index + 1}</div>
				<div style={{ color: "#6b7280", fontSize: "14px" }}>Mounting…</div>
			</div>
		);
	}

	return (
		<div style={styles.panel}>
			<div style={styles.panelTitle}>Collection {index + 1}</div>
			<div style={{ marginBottom: "8px" }}>
				<input
					style={{ ...styles.input, marginBottom: "4px" }}
					type="text"
					placeholder="New todo..."
					value={newTitle}
					onChange={(e) => setNewTitle(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleAdd()}
					disabled={!isReady}
				/>
				<button
					type="button"
					style={{
						...styles.button,
						...styles.primaryButton,
						...styles.smallButton,
					}}
					onClick={handleAdd}
					disabled={!isReady || !newTitle.trim()}
				>
					Add
				</button>
			</div>
			<div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>
				{isReady ? "Ready" : "Loading..."} · {activeTodos.length} items
			</div>
			<div>
				{activeTodos.length === 0 ? (
					<p style={{ color: "#9ca3af", fontSize: "13px" }}>No todos</p>
				) : (
					activeTodos.map((todo) => (
						<div key={todo.id} style={styles.todoItem}>
							<button
								type="button"
								style={{ ...styles.smallButton, ...styles.secondaryButton }}
								onClick={() => handleToggle(todo.id, todo.completed)}
							>
								{todo.completed ? "✓" : "○"}
							</button>
							<span
								style={{
									...styles.todoTitle,
									textDecoration: todo.completed ? "line-through" : "none",
								}}
							>
								{todo.title}
							</span>
							<button
								type="button"
								style={{ ...styles.smallButton, ...styles.dangerButton }}
								onClick={() => handleDelete(todo.id)}
							>
								×
							</button>
						</div>
					))
				)}
			</div>
		</div>
	);
}

export function MemoryCollectionNSyncTestPage() {
	const [n, setN] = useState(INITIAL_N);
	const collectionsRef = useRef<
		(MemoryCollection<typeof memoryTodoSchema> | null)[]
	>([]);

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<h1>N Collections Sync</h1>
				<p>
					{n} memory collection{n !== 1 ? "s" : ""} that broadcast to each
					other. Add/remove count; new collections get an initial sync from the
					first.
				</p>
			</div>

			<div style={styles.notice}>
				<strong>2-way sync:</strong> Each collection has{" "}
				<code>onBroadcast</code> and <code>utils.receiveSync</code>. Changes in
				any collection are applied to the others via the sync layer (no
				rebroadcast loop).
			</div>

			<div style={styles.controls}>
				<span style={{ marginRight: "8px" }}>Collections:</span>
				<button
					type="button"
					style={{ ...styles.button, ...styles.secondaryButton }}
					onClick={() => setN((prev) => Math.max(MIN_N, prev - 1))}
					disabled={n <= MIN_N}
				>
					−
				</button>
				<strong style={{ minWidth: "24px", textAlign: "center" }}>{n}</strong>
				<button
					type="button"
					style={{ ...styles.button, ...styles.secondaryButton }}
					onClick={() => setN((prev) => Math.min(MAX_N, prev + 1))}
					disabled={n >= MAX_N}
				>
					+
				</button>
			</div>

			<div style={styles.grid}>
				{Array.from({ length: n }, (_, i) => (
					<SingleCollectionPanel
						key={i}
						index={i}
						collectionsRef={collectionsRef}
					/>
				))}
			</div>
		</div>
	);
}
