import { useCallback, useState } from "react";
import { flushSync } from "react-dom";
import { useLoaderData } from "react-router";
import { formatDateWithMs } from "~/utils/date-format";
import type { todoLoader } from "~/utils/todo-loaders";
import type * as schema from "test-schema/schema";

type Todo = typeof schema.todoTable.$inferSelect;

interface EnhancedTodoItemProps {
	todo: Todo;
	onToggleComplete: (todo: Todo) => void;
	onDelete: (todo: Todo) => void;
	onRestore: (todo: Todo) => void;
	onPurge: (todo: Todo) => void;
	onUpdate: (todo: Todo, title: string) => void;
	selected: boolean;
	onSelect: (todo: Todo, selected: boolean) => void;
	deltaMs?: number;
}

export const EnhancedTodoItem = ({
	todo,
	onToggleComplete,
	onDelete,
	onRestore,
	onPurge,
	onUpdate,
	selected,
	onSelect,
	deltaMs,
}: EnhancedTodoItemProps) => {
	const data = useLoaderData<typeof todoLoader>();
	let locale = "en-US";
	if (data.success) {
		locale = data.result.locale;
	}

	const isDeleted = todo.deletedAt !== null;
	const [editValue, setEditValue] = useState<string | null>(null);

	const handleSave = useCallback(() => {
		if (editValue === null) return;
		const trimmed = editValue.trim();
		if (trimmed && trimmed !== todo.title) {
			onUpdate(todo, trimmed);
		}
	}, [todo, onUpdate, editValue]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				e.currentTarget.blur();
			} else if (e.key === "Escape") {
				e.preventDefault();
				flushSync(() => setEditValue(null));
				e.currentTarget.blur();
			}
		},
		[],
	);

	const handleBlur = useCallback(() => {
		if (editValue === null) return;
		handleSave();
		setEditValue(null);
	}, [handleSave, editValue]);

	return (
		<div
			className={`todo-item ${todo.completed ? "completed" : ""} ${isDeleted ? "deleted" : ""} ${selected ? "selected" : ""}`}
			data-testid={`todo-item-${todo.id}`}
		>
			<div className="todo-actions-left">
				<input
					type="checkbox"
					className="todo-checkbox"
					checked={selected}
					onChange={(e) => onSelect(todo, e.target.checked)}
					title="Select for bulk actions"
					data-testid={`todo-select-${todo.id}`}
				/>
				<button
					className="todo-toggle-btn"
					onClick={() => onToggleComplete(todo)}
					disabled={isDeleted}
					type="button"
					aria-label={
						todo.completed ? "Mark as incomplete" : "Mark as complete"
					}
					data-testid={`todo-complete-${todo.id}`}
				>
					{todo.completed ? "✓" : "○"}
				</button>
			</div>

			<div className="todo-content">
				<input
					className="todo-input"
					type="text"
					value={editValue ?? todo.title}
					onChange={(e) => setEditValue(e.target.value)}
					onFocus={() => setEditValue(todo.title)}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					disabled={isDeleted || todo.completed}
					data-testid={`todo-title-${todo.id}`}
				/>
				<div className="todo-meta">
					<small title={formatDateWithMs(todo.createdAt, locale)}>
						Created: {todo.createdAt.toLocaleString(locale)}
						{deltaMs !== undefined && (
							<span className="todo-delta">+{deltaMs}ms</span>
						)}
					</small>
					{todo.createdAt.getTime() !== todo.updatedAt.getTime() && (
						<small
							title={formatDateWithMs(todo.updatedAt, locale)}
							className="todo-updated"
						>
							• Updated: {todo.updatedAt.toLocaleString(locale)}
						</small>
					)}
				</div>
			</div>

			{isDeleted ? (
				<>
					<button
						className="todo-restore-btn"
						onClick={() => onRestore(todo)}
						type="button"
						data-testid={`todo-restore-${todo.id}`}
					>
						Restore
					</button>
					<button
						className="todo-purge-btn"
						onClick={() => onPurge(todo)}
						type="button"
						data-testid={`todo-purge-${todo.id}`}
					>
						Purge
					</button>
				</>
			) : (
				<button
					className="todo-delete-btn"
					onClick={() => onDelete(todo)}
					type="button"
					data-testid={`todo-delete-${todo.id}`}
				>
					Delete
				</button>
			)}
		</div>
	);
};
