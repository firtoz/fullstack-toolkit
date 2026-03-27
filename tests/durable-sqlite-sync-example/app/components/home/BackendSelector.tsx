import type { BackendMode } from "./types";

type Props = {
	backendMode: BackendMode;
	onChange: (mode: BackendMode) => void;
};

export function BackendSelector({ backendMode, onChange }: Props) {
	return (
		<label>
			Client backend:
			<select
				value={backendMode}
				onChange={(e) => onChange(e.target.value as BackendMode)}
			>
				<option value="memory">memory</option>
				<option value="indexeddb">indexeddb</option>
				<option value="sqlite">sqlite-wasm</option>
			</select>
		</label>
	);
}
