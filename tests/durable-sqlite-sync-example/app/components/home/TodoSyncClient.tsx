import {
	connectSync,
	type SyncClientBridge,
	type SyncClientMessage,
} from "@firtoz/collection-sync";
import type { Collection } from "@tanstack/db";
import { isNull, useLiveQuery } from "@tanstack/react-db";
import { useCallback, useEffect, useState } from "react";
import superjson from "superjson";
import type { TodoId, TodoRow } from "./types";

export type WsTransport = "json" | "msgpack";

type Props = {
	collection: Collection<TodoRow>;
	bridge: SyncClientBridge<TodoRow>;
	setTransportSend: (send: (msg: SyncClientMessage) => void) => void;
	roomId: string;
	showDeleted: boolean;
	wsTransport?: WsTransport;
};

function toTodoId(value: string): TodoId {
	return value as TodoId;
}

export function TodoSyncClient({
	collection,
	bridge,
	setTransportSend,
	roomId,
	showDeleted,
	wsTransport = "json",
}: Props) {
	const [title, setTitle] = useState("");
	const [editingId, setEditingId] = useState<TodoId | null>(null);
	const [editText, setEditText] = useState("");
	const [frames, setFrames] = useState<string[]>([]);
	const { data: todos } = useLiveQuery(
		(q) => {
			let query = q.from({
				todo: collection,
			});

			if (!showDeleted) {
				query = query.where(({ todo }) => {
					return isNull(todo.deletedAt);
				});
			}

			return query.orderBy(({ todo }) => {
				return todo.createdAt;
			}, "asc");
		},
		[collection, showDeleted],
	);

	useEffect(() => {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = new URL(
			`${protocol}//${window.location.host}/room/${roomId}/websocket`,
		);
		if (wsTransport === "msgpack") {
			wsUrl.searchParams.set("transport", "msgpack");
		}

		const disconnect = connectSync(bridge, {
			url: wsUrl.toString(),
			transport: wsTransport === "msgpack" ? "msgpack" : "json",
			setTransportSend: (send) => {
				setTransportSend((msg) => {
					setFrames((prev) => [
						...prev.slice(-19),
						`-> ${JSON.stringify(msg)}`,
					]);
					send(msg);
				});
			},
			serializeJson: (value: unknown) => superjson.stringify(value),
			deserializeJson: (raw: string) => superjson.parse(raw),
			onServerMessage: (msg) => {
				setFrames((prev) => [...prev.slice(-19), `<- ${JSON.stringify(msg)}`]);
			},
		});

		return () => {
			disconnect();
		};
	}, [bridge, roomId, setTransportSend, wsTransport]);

	const addTodo = async () => {
		if (!title.trim()) return;
		const now = new Date();
		const tx = collection.insert({
			id: toTodoId(crypto.randomUUID()),
			title: title.trim(),
			completed: false,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		});
		await tx.isPersisted.promise;
		setTitle("");
	};

	const saveEdit = async (todoId: TodoId) => {
		if (!editText.trim()) return;
		const now = new Date();
		const tx = collection.update(todoId, (draft) => {
			draft.title = editText.trim();
			draft.updatedAt = now;
		});
		await tx.isPersisted.promise;
		setEditingId(null);
		setEditText("");
	};

	const cancelEdit = () => {
		setEditingId(null);
		setEditText("");
	};

	const editInputRef = useCallback((node: HTMLInputElement | null) => {
		node?.focus();
	}, []);

	const deleteTodo = async (todo: TodoRow) => {
		const now = new Date();
		const tx = collection.update(todo.id, (draft) => {
			draft.deletedAt = now;
			draft.updatedAt = now;
		});
		await tx.isPersisted.promise;
	};

	const restoreTodo = async (todo: TodoRow) => {
		const now = new Date();
		const tx = collection.update(todo.id, (draft) => {
			draft.deletedAt = null;
			draft.updatedAt = now;
		});
		await tx.isPersisted.promise;
	};

	const reallyDeleteTodo = async (todo: TodoRow) => {
		if (
			!window.confirm(
				"This will permanently delete this todo from this backend. Continue?",
			)
		) {
			return;
		}
		const tx = collection.delete(todo.id);
		await tx.isPersisted.promise;
	};

	const truncateTodos = async () => {
		if (
			!window.confirm(
				"This will permanently clear all todos in this room for this backend. Continue?",
			)
		) {
			return;
		}
		await collection.utils.truncate();
	};

	return (
		<>
			<div style={{ marginTop: 12 }}>
				<input
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="Add todo"
				/>
				<button type="button" onClick={() => void addTodo()}>
					Add
				</button>
				<button
					type="button"
					onClick={() => {
						void truncateTodos();
					}}
					style={{ marginLeft: 8 }}
				>
					Truncate (nuke)
				</button>
			</div>
			<ul>
				{(todos ?? []).map((todo) => (
					<li key={todo.id}>
						{editingId === todo.id ? (
							<>
								<input
									ref={editInputRef}
									value={editText}
									onChange={(e) => setEditText(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") void saveEdit(todo.id);
										if (e.key === "Escape") cancelEdit();
									}}
									placeholder="Edit todo"
								/>
								<button type="button" onClick={() => void saveEdit(todo.id)}>
									Save
								</button>
								<button type="button" onClick={cancelEdit}>
									Cancel
								</button>
							</>
						) : (
							<>
								{todo.title}{" "}
								{showDeleted && todo.deletedAt !== null ? (
									<>
										<button
											type="button"
											aria-label={`restore-${todo.id}`}
											onClick={() => {
												void restoreTodo(todo);
											}}
										>
											Restore
										</button>{" "}
										<button
											type="button"
											aria-label={`really-delete-${todo.id}`}
											onClick={() => {
												void reallyDeleteTodo(todo);
											}}
										>
											Really Delete
										</button>
									</>
								) : (
									<>
										<button
											type="button"
											aria-label={`edit-${todo.id}`}
											onClick={() => {
												setEditingId(todo.id);
												setEditText(todo.title);
											}}
										>
											Edit
										</button>{" "}
										<button
											type="button"
											aria-label={`delete-${todo.id}`}
											onClick={() => {
												void deleteTodo(todo);
											}}
										>
											Delete
										</button>
									</>
								)}
							</>
						)}
					</li>
				))}
			</ul>
			<h3>Sync Inspector</h3>
			<pre
				style={{
					maxHeight: 220,
					overflow: "auto",
					background: "#eee",
					padding: 8,
				}}
			>
				{frames.join("\n")}
			</pre>
		</>
	);
}
