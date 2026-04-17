import { useCallback, useState } from "react";
import { isNull, useLiveQuery } from "@tanstack/react-db";
import type * as schema from "test-schema/schema";
import { TodoInput } from "./TodoInput";
import { EnhancedTodoItem } from "./EnhancedTodoItem";
import type { BaseTodoCollection } from "~/types/collection";

type Todo = typeof schema.todoTable.$inferSelect;

interface TodoListContainerProps {
	collection: BaseTodoCollection;
	title?: string;
	description?: string;
}

export const TodoListContainer = ({
	collection,
	title = "Tasks",
	description = "Drizzle collections",
}: TodoListContainerProps) => {
	const [showDeleted, setShowDeleted] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const { data: todos, isLoading } = useLiveQuery(
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

	const handleAddTodo = useCallback(
		(title: string) => {
			collection.insert({
				title,
			});
		},
		[collection],
	);

	const handleBatchAddTodo = useCallback(
		(titles: string[]) => {
			titles.forEach((title) => {
				collection.insert({
					title,
				});
			});
		},
		[collection],
	);

	const handleSelect = useCallback((todo: Todo, selected: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			const id = String(todo.id);
			if (selected) {
				next.add(id);
			} else {
				next.delete(id);
			}
			return next;
		});
	}, []);

	const handleSelectAll = useCallback(() => {
		if (selectedIds.size === todos?.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(todos?.map((t) => String(t.id)) ?? []));
		}
	}, [selectedIds.size, todos]);

	const handleToggleComplete = useCallback(
		(todo: Todo) => {
			if (todo.deletedAt) {
				return;
			}

			collection.update(todo.id, (draft) => {
				draft.completed = !draft.completed;
			});
		},
		[collection],
	);

	const handleDeleteTodo = useCallback(
		(todo: Todo) => {
			collection.update(todo.id, (draft) => {
				draft.deletedAt = new Date();
			});
		},
		[collection],
	);

	const handleRestoreTodo = useCallback(
		(todo: Todo) => {
			collection.update(todo.id, (draft) => {
				draft.deletedAt = null;
			});
		},
		[collection],
	);

	const handlePurgeTodo = useCallback(
		(todo: Todo) => {
			collection.delete(todo.id);
		},
		[collection],
	);

	const handleUpdateTodo = useCallback(
		(todo: Todo, title: string) => {
			collection.update(todo.id, (draft) => {
				draft.title = title;
			});
		},
		[collection],
	);

	const handleBulkComplete = useCallback(() => {
		const selectedTodos =
			todos?.filter((t) => selectedIds.has(String(t.id))) ?? [];
		const idsToComplete = selectedTodos
			.filter((t) => !t.deletedAt && !t.completed)
			.map((t) => t.id);

		if (idsToComplete.length > 0) {
			collection.update(idsToComplete, (drafts) => {
				for (const draft of drafts) {
					draft.completed = true;
				}
			});
		}
	}, [todos, selectedIds, collection]);

	const handleBulkUndoComplete = useCallback(() => {
		const selectedTodos =
			todos?.filter((t) => selectedIds.has(String(t.id))) ?? [];
		const idsToUndo = selectedTodos
			.filter((t) => !t.deletedAt && t.completed)
			.map((t) => t.id);

		if (idsToUndo.length > 0) {
			collection.update(idsToUndo, (drafts) => {
				for (const draft of drafts) {
					draft.completed = false;
				}
			});
		}
	}, [todos, selectedIds, collection]);

	const handleBulkDelete = useCallback(() => {
		const selectedTodos =
			todos?.filter((t) => selectedIds.has(String(t.id))) ?? [];
		const toSoftDelete = selectedTodos.filter((t) => !t.deletedAt);

		if (toSoftDelete.length > 0) {
			collection.update(
				toSoftDelete.map((t) => t.id),
				(drafts) => {
					for (const draft of drafts) {
						draft.deletedAt = new Date();
					}
				},
			);
		}
		setSelectedIds(new Set());
	}, [todos, selectedIds, collection, setSelectedIds]);

	const handleBulkPurge = useCallback(() => {
		const selectedTodos =
			todos?.filter((t) => selectedIds.has(String(t.id))) ?? [];
		const deletedTodos = selectedTodos.filter((t) => t.deletedAt);

		if (deletedTodos.length > 0) {
			collection.delete(deletedTodos.map((t) => t.id));
		}
		setSelectedIds(new Set());
	}, [todos, selectedIds, collection, setSelectedIds]);

	if (isLoading) {
		return null;
	}

	const completedCount = todos?.filter((t) => t.completed).length ?? 0;
	const totalCount = todos?.length ?? 0;
	const pendingCount = totalCount - completedCount;

	const selectedTodos =
		todos?.filter((t) => selectedIds.has(String(t.id))) ?? [];
	const selectedCompleted = selectedTodos.filter(
		(t) => t.completed && !t.deletedAt,
	).length;
	const selectedIncomplete = selectedTodos.filter(
		(t) => !t.completed && !t.deletedAt,
	).length;

	return (
		<div className="todo-container">
			<div className="todo-header">
				<h1 className="todo-title">{title}</h1>
				<p className="todo-desc">{description}</p>

				<div className="todo-stats">
					<div className="stat-card">
						<div className="stat-label">Total</div>
						<div className="stat-value" data-testid="count-total">
							{totalCount}
						</div>
					</div>
					<div className="stat-card">
						<div className="stat-label">Pending</div>
						<div className="stat-value" data-testid="count-pending">
							{pendingCount}
						</div>
					</div>
					<div className="stat-card">
						<div className="stat-label">Done</div>
						<div className="stat-value" data-testid="count-done">
							{completedCount}
						</div>
					</div>
				</div>
			</div>

			<div className="todo-body">
				<TodoInput onAdd={handleAddTodo} onBatchAdd={handleBatchAddTodo} />

				<div className="toolbar">
					<button
						className="btn-sm"
						onClick={() => setShowDeleted(!showDeleted)}
						type="button"
						data-testid="toggle-deleted"
					>
						{showDeleted ? "Hide Deleted" : "Show Deleted"}
					</button>

					{todos && todos.length > 0 && (
						<>
							<button
								className="btn-sm"
								onClick={handleSelectAll}
								type="button"
								data-testid="select-all"
							>
								{selectedIds.size === todos.length
									? "Deselect All"
									: "Select All"}
							</button>

							{selectedIds.size > 0 && (
								<>
									{selectedIncomplete > 0 && (
										<button
											className="btn-sm btn-primary-subtle"
											onClick={handleBulkComplete}
											type="button"
											data-testid="bulk-complete"
										>
											Complete ({selectedIncomplete})
										</button>
									)}
									{selectedCompleted > 0 && (
										<button
											className="btn-sm btn-primary-subtle"
											onClick={handleBulkUndoComplete}
											type="button"
											data-testid="bulk-uncomplete"
										>
											Reopen ({selectedCompleted})
										</button>
									)}
									{showDeleted ? (
										<button
											className="btn-sm btn-danger-subtle"
											onClick={handleBulkPurge}
											type="button"
											data-testid="bulk-purge"
										>
											Purge ({selectedIds.size})
										</button>
									) : (
										<button
											className="btn-sm btn-danger-subtle"
											onClick={handleBulkDelete}
											type="button"
											data-testid="bulk-delete"
										>
											Delete ({selectedIds.size})
										</button>
									)}
								</>
							)}
						</>
					)}
				</div>

				{todos && todos.length > 0 ? (
					<div data-testid="todo-list">
						{todos.map((todo, index) => {
							// Calculate delta from previous item's createdAt
							let deltaMs: number | undefined;
							if (index > 0 && todos[index - 1]) {
								const prevCreatedAt = todos[index - 1].createdAt.getTime();
								const currentCreatedAt = todo.createdAt.getTime();
								deltaMs = currentCreatedAt - prevCreatedAt;
							}

							return (
								<EnhancedTodoItem
									key={String(todo.id)}
									todo={todo}
									onToggleComplete={handleToggleComplete}
									onDelete={handleDeleteTodo}
									onRestore={handleRestoreTodo}
									onPurge={handlePurgeTodo}
									onUpdate={handleUpdateTodo}
									selected={selectedIds.has(String(todo.id))}
									onSelect={handleSelect}
									deltaMs={deltaMs}
								/>
							);
						})}
					</div>
				) : (
					<div className="empty-state" data-testid="empty-state">
						<div className="empty-icon">📝</div>
						<p className="empty-text">
							No tasks yet. Add one above to get started.
						</p>
					</div>
				)}
			</div>
		</div>
	);
};
