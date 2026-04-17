import { useState, useCallback, useEffect } from "react";

interface TodoInputProps {
	onAdd: (title: string) => void;
	onBatchAdd?: (titles: string[]) => void;
}

export const TodoInput = ({ onAdd, onBatchAdd }: TodoInputProps) => {
	const [values, setValues] = useState<string[]>([""]);

	// Auto-add new line when typing in the last input
	useEffect(() => {
		const lastValue = values[values.length - 1];
		if (lastValue && values.length < 20) {
			// Limit to 20 inputs
			setValues([...values, ""]);
		}
	}, [values]);

	// Auto-remove empty trailing inputs (but never the first one)
	useEffect(() => {
		if (values.length > 1) {
			const lastValue = values[values.length - 1];
			const secondLastValue = values[values.length - 2];
			if (!lastValue && !secondLastValue) {
				setValues(values.slice(0, -1));
			}
		}
	}, [values]);

	const handleValueChange = useCallback((index: number, newValue: string) => {
		setValues((prev) => {
			const updated = [...prev];
			updated[index] = newValue;
			return updated;
		});
	}, []);

	const handleAddSingle = useCallback(
		(index: number) => {
			const trimmed = values[index].trim();
			if (trimmed) {
				onAdd(trimmed);
				// Don't clear or remove any inputs
			}
		},
		[values, onAdd],
	);

	const handleBatchAdd = useCallback(() => {
		const nonEmpty = values.map((v) => v.trim()).filter(Boolean);
		if (nonEmpty.length > 0) {
			if (onBatchAdd && nonEmpty.length > 1) {
				onBatchAdd(nonEmpty);
			} else {
				for (const title of nonEmpty) {
					onAdd(title);
				}
			}
			// Clear all inputs after batch add
			setValues([""]);
		}
	}, [values, onAdd, onBatchAdd]);

	const nonEmptyCount = values.filter((v) => v.trim()).length;
	const buttonText = nonEmptyCount > 1 ? "Add Tasks" : "Add Task";

	return (
		<div className="input-group-multi">
			{values.map((value, index) => (
				<div key={index} className="input-row">
					{index > 0 && (
						<button
							className="add-btn-inline"
							onClick={() => handleAddSingle(index)}
							disabled={!value.trim()}
							type="button"
							data-testid={`add-${index}`}
							title="Add this task"
						>
							+
						</button>
					)}
					<input
						type="text"
						className="main-input"
						value={value}
						onChange={(e) => handleValueChange(index, e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && value.trim()) {
								if (e.shiftKey) {
									handleBatchAdd();
								} else {
									handleAddSingle(index);
								}
							}
						}}
						placeholder={
							index === 0 ? "Add a new task..." : "Add another task..."
						}
						data-testid={index === 0 ? "todo-input" : `todo-input-${index}`}
					/>
				</div>
			))}
			<button
				className="add-btn"
				onClick={handleBatchAdd}
				disabled={nonEmptyCount === 0}
				type="button"
				data-testid="add-task-button"
			>
				{buttonText}
			</button>
		</div>
	);
};
