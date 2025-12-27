import {
	useState,
	useEffect,
	useCallback,
	useMemo,
	useRef,
	type KeyboardEvent,
} from "react";
import type { RoutePath } from "@firtoz/router-toolkit";
import {
	DrizzleIndexedDBProvider,
	useDrizzleIndexedDB,
	createMultiClientTransport,
	createProxyIDbCreator,
	createProxyServer,
	migrateIndexedDBWithFunctions,
	deleteIndexedDB,
	type IDBProxyServer,
	type IDBProxyClientTransport,
	type IDBProxySyncMessage,
} from "@firtoz/drizzle-indexeddb";
import { useLiveQuery } from "@tanstack/react-db";
import * as schema from "test-schema/schema";
import { migrations } from "test-schema/drizzle/indexeddb-migrations";
import { ClientOnly } from "~/components/shared/ClientOnly";
import { makeId } from "@firtoz/drizzle-utils";
import { todoTable } from "test-schema/schema";

// ============================================================================
// Styles
// ============================================================================

const styles = {
	container: {
		padding: "20px",
		fontFamily: "system-ui, -apple-system, sans-serif",
		maxWidth: "1400px",
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
	clientGrid: {
		display: "grid",
		gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
		gap: "16px",
		marginBottom: "24px",
	},
	clientCard: {
		border: "1px solid #e5e7eb",
		borderRadius: "12px",
		padding: "16px",
		background: "white",
		boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
	},
	clientHeader: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: "12px",
	},
	clientTitle: {
		fontSize: "16px",
		fontWeight: 600,
		margin: 0,
	},
	badge: {
		fontSize: "12px",
		padding: "2px 8px",
		borderRadius: "9999px",
		background: "#dbeafe",
		color: "#1e40af",
	},
	todoList: {
		listStyle: "none",
		padding: 0,
		margin: "12px 0 0 0",
		maxHeight: "200px",
		overflowY: "auto" as const,
	},
	todoItem: {
		padding: "8px",
		borderBottom: "1px solid #f3f4f6",
		fontSize: "13px",
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
	},
	todoTitle: {
		flex: 1,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap" as const,
	},
	syncLog: {
		border: "1px solid #e5e7eb",
		borderRadius: "8px",
		padding: "12px",
		background: "#f9fafb",
		maxHeight: "150px",
		overflowY: "auto" as const,
		fontSize: "12px",
		fontFamily: "monospace",
	},
	syncEntry: {
		padding: "4px 0",
		borderBottom: "1px solid #e5e7eb",
	},
};

// ============================================================================
// TodoItem Component (for inline editing)
// ============================================================================

interface TodoItemProps {
	todo: { id: string; title: string; completed: boolean };
	onToggle: (id: string, completed: boolean) => void;
	onUpdateTitle: (id: string, title: string) => void;
	onDelete: (id: string) => void;
}

const TodoItem = ({
	todo,
	onToggle,
	onUpdateTitle,
	onDelete,
}: TodoItemProps) => {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(todo.title);

	const handleStartEdit = () => {
		setEditValue(todo.title);
		setIsEditing(true);
	};

	const handleSave = () => {
		if (editValue.trim() && editValue !== todo.title) {
			onUpdateTitle(todo.id, editValue.trim());
		}
		setIsEditing(false);
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			setEditValue(todo.title);
			setIsEditing(false);
		}
	};

	return (
		<li
			style={{
				...styles.todoItem,
				opacity: todo.completed ? 0.6 : 1,
			}}
			data-testid={`todo-${todo.id}`}
		>
			<input
				type="checkbox"
				checked={todo.completed}
				onChange={() => onToggle(todo.id, todo.completed)}
				style={{ marginRight: "8px", cursor: "pointer" }}
			/>
			{isEditing ? (
				<input
					type="text"
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					onBlur={handleSave}
					onKeyDown={handleKeyDown}
					ref={(input) => input?.focus()}
					style={{
						flex: 1,
						padding: "2px 4px",
						fontSize: "13px",
						border: "1px solid #3b82f6",
						borderRadius: "4px",
						outline: "none",
					}}
				/>
			) : (
				<button
					type="button"
					onClick={handleStartEdit}
					style={{
						...styles.todoTitle,
						textDecoration: todo.completed ? "line-through" : "none",
						cursor: "pointer",
						background: "none",
						border: "none",
						padding: 0,
						font: "inherit",
						textAlign: "left",
					}}
					title="Click to edit"
				>
					{todo.title}
				</button>
			)}
			<button
				type="button"
				onClick={() => onDelete(todo.id)}
				style={{
					...styles.button,
					padding: "4px 8px",
					fontSize: "12px",
					background: "#fee2e2",
					color: "#991b1b",
					marginLeft: "8px",
				}}
			>
				×
			</button>
		</li>
	);
};

// ============================================================================
// TodoList Component
// ============================================================================

const TodoList = ({
	clientId,
	onDelete,
}: {
	clientId: string;
	onDelete?: (id: string) => void;
}) => {
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();
	const todoCollection = useCollection("todoTable");

	const { data: todos, isLoading } = useLiveQuery((q) =>
		q.from({ todo: todoCollection }),
	);

	const handleAddTodo = useCallback(() => {
		const id = makeId(todoTable, crypto.randomUUID());
		todoCollection.insert({
			id,
			title: `Todo from Client ${clientId} - ${new Date().toLocaleTimeString()}`,
			content: "Test content",
			completed: false,
			priority: Math.floor(Math.random() * 10),
			status: "pending",
		});
	}, [todoCollection, clientId]);

	const handleDeleteTodo = useCallback(
		(todoId: string) => {
			todoCollection.delete(makeId(todoTable, todoId));
		},
		[todoCollection],
	);

	const handleToggleCompleted = useCallback(
		(todoId: string, currentCompleted: boolean) => {
			todoCollection.update(makeId(todoTable, todoId), (draft) => {
				draft.completed = !currentCompleted;
			});
		},
		[todoCollection],
	);

	const handleUpdateTitle = useCallback(
		(todoId: string, newTitle: string) => {
			todoCollection.update(makeId(todoTable, todoId), (draft) => {
				draft.title = newTitle;
			});
		},
		[todoCollection],
	);

	const handleClearAll = useCallback(async () => {
		console.log(`[Client ${clientId}] Truncating all todos...`);
		// Use collection.utils.truncate() - clears backend and updates local store
		await todoCollection.utils.truncate();
		console.log(`[Client ${clientId}] Truncate complete`);
	}, [todoCollection, clientId]);

	return (
		<div style={styles.clientCard} data-testid={`client-${clientId}`}>
			<div style={styles.clientHeader}>
				<h3 style={styles.clientTitle}>Client {clientId}</h3>
				<span style={styles.badge}>
					{isLoading ? "Loading..." : `${todos?.length ?? 0} todos`}
				</span>
			</div>

			<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
				<button
					type="button"
					onClick={handleAddTodo}
					style={{ ...styles.button, ...styles.primaryButton }}
					data-testid={`add-todo-${clientId}`}
				>
					Add Todo
				</button>
				<button
					type="button"
					onClick={handleClearAll}
					style={{ ...styles.button, background: "#fef3c7", color: "#92400e" }}
					data-testid={`clear-all-${clientId}`}
					title="Clear all todos (truncate)"
				>
					Clear All
				</button>
				{onDelete && (
					<button
						type="button"
						onClick={() => onDelete(clientId)}
						style={{ ...styles.button, ...styles.secondaryButton }}
					>
						× Remove
					</button>
				)}
			</div>

			<ul style={styles.todoList}>
				{todos?.map((todo) => (
					<TodoItem
						key={todo.id}
						todo={todo}
						onToggle={handleToggleCompleted}
						onUpdateTitle={handleUpdateTitle}
						onDelete={handleDeleteTodo}
					/>
				))}
				{(!todos || todos.length === 0) && (
					<li
						style={{
							...styles.todoItem,
							color: "#9ca3af",
							fontStyle: "italic",
						}}
					>
						No todos yet
					</li>
				)}
			</ul>
		</div>
	);
};

// ============================================================================
// Client Wrapper
// ============================================================================

const ClientWrapper = ({
	clientId,
	transport,
	onDelete,
}: {
	clientId: string;
	transport: IDBProxyClientTransport;
	onDelete?: (id: string) => void;
}) => {
	const dbCreator = useMemo(
		() => createProxyIDbCreator(transport),
		[transport],
	);

	// Wire up sync messages to the provider
	const handleSyncReady = useCallback(
		(handleSync: (message: IDBProxySyncMessage) => void) => {
			transport.onSync(handleSync);
		},
		[transport],
	);

	return (
		<DrizzleIndexedDBProvider
			dbName="proxy-sync-test.db"
			schema={schema}
			dbCreator={dbCreator}
			debug={false}
			onSyncReady={handleSyncReady}
		>
			<TodoList clientId={clientId} onDelete={onDelete} />
		</DrizzleIndexedDBProvider>
	);
};

// ============================================================================
// Main Multi-Client Test
// ============================================================================

const MultiClientSyncTest = () => {
	const [isReady, setIsReady] = useState(false);
	const [clients, setClients] = useState<
		Array<{ id: string; transport: IDBProxyClientTransport }>
	>([]);
	const serverRef = useRef<IDBProxyServer | null>(null);
	const createClientTransportRef = useRef<
		(() => IDBProxyClientTransport) | null
	>(null);
	const nextClientId = useRef(1);

	// Create transport and server
	useEffect(() => {
		const { createClientTransport, serverTransport } =
			createMultiClientTransport();
		createClientTransportRef.current = createClientTransport;

		// Create a dbCreator that runs migrations
		const migratingDbCreator = async (dbName: string) => {
			console.log(`[Server] Opening database with migrations: ${dbName}`);
			return await migrateIndexedDBWithFunctions(dbName, migrations, false);
		};

		// Create server with migration-aware dbCreator
		const server = createProxyServer({
			transport: serverTransport,
			debug: false,
			dbCreator: migratingDbCreator,
		});

		serverRef.current = server;

		// Create initial clients
		const initialClients = [1, 2].map((num) => ({
			id: String(num),
			transport: createClientTransport(),
		}));
		nextClientId.current = 3;
		setClients(initialClients);
		setIsReady(true);

		return () => {
			server.stop();
		};
	}, []);

	const addClient = useCallback(() => {
		if (!createClientTransportRef.current) return;

		const id = String(nextClientId.current++);
		const transport = createClientTransportRef.current();
		setClients((prev) => [...prev, { id, transport }]);
	}, []);

	const removeClient = useCallback((clientId: string) => {
		setClients((prev) => {
			const client = prev.find((c) => c.id === clientId);
			if (client?.transport.dispose) {
				client.transport.dispose();
			}
			return prev.filter((c) => c.id !== clientId);
		});
	}, []);

	// Nuclear option: delete entire database and recreate everything
	const deleteDatabase = useCallback(async () => {
		if (
			!confirm(
				"This will DELETE the entire database and disconnect all clients. Continue?",
			)
		) {
			return;
		}

		console.log("[Test] Stopping server and disconnecting clients...");

		// Stop server first - this closes all database connections
		serverRef.current?.stop();
		serverRef.current = null;

		// Dispose all client transports
		for (const client of clients) {
			client.transport.dispose?.();
		}

		// Clear clients while we rebuild
		setClients([]);

		console.log("[Test] Deleting database...");
		await deleteIndexedDB("proxy-sync-test.db");

		console.log("[Test] Recreating server and clients...");

		// Recreate transport and server
		const { createClientTransport, serverTransport } =
			createMultiClientTransport();
		createClientTransportRef.current = createClientTransport;

		// Create a dbCreator that runs migrations (same as initial setup)
		const migratingDbCreator = async (dbName: string) => {
			console.log(`[Server] Opening database with migrations: ${dbName}`);
			return await migrateIndexedDBWithFunctions(dbName, migrations, false);
		};

		const server = createProxyServer({
			transport: serverTransport,
			debug: false,
			dbCreator: migratingDbCreator,
		});

		serverRef.current = server;

		// Recreate 2 fresh clients
		const newClients = [1, 2].map((num) => ({
			id: String(num),
			transport: createClientTransport(),
		}));
		nextClientId.current = 3;
		setClients(newClients);

		console.log("[Test] Database recreated successfully");
	}, [clients]);

	if (!isReady) {
		return (
			<div style={styles.container}>
				<div>Initializing server...</div>
			</div>
		);
	}

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<h1>IDB Proxy Multi-Client Sync Test</h1>
				<p style={{ color: "#6b7280", marginTop: "8px" }}>
					Add todos from any client and watch them sync to all others in
					real-time. Each client has its own transport connection to the server.
				</p>
			</div>

			<div style={styles.controls}>
				<button
					type="button"
					onClick={addClient}
					style={{ ...styles.button, ...styles.primaryButton }}
					data-testid="add-client"
				>
					+ Add Client
				</button>
				<button
					type="button"
					onClick={deleteDatabase}
					style={{ ...styles.button, ...styles.dangerButton }}
					data-testid="delete-db"
					title="Delete entire database (nuclear option)"
				>
					🗑️ Delete DB
				</button>
				<span style={{ color: "#6b7280", fontSize: "14px" }}>
					{clients.length} client{clients.length !== 1 ? "s" : ""} connected
				</span>
			</div>

			<div style={styles.clientGrid}>
				{clients.map((client) => (
					<ClientWrapper
						key={client.id}
						clientId={client.id}
						transport={client.transport}
						onDelete={clients.length > 1 ? removeClient : undefined}
					/>
				))}
			</div>

			{clients.length === 0 && (
				<div
					style={{
						textAlign: "center",
						padding: "40px",
						color: "#6b7280",
						background: "#f9fafb",
						borderRadius: "8px",
					}}
				>
					No clients connected. Click "Add Client" to start.
				</div>
			)}
		</div>
	);
};

// ============================================================================
// Main Page
// ============================================================================

export default function ProxyTest() {
	return (
		<ClientOnly>
			<MultiClientSyncTest />
		</ClientOnly>
	);
}

export const route: RoutePath<"/collections/proxy-test"> =
	"/collections/proxy-test";
