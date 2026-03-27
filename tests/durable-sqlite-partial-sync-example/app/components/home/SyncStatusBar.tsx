import type { PartialSyncState } from "@firtoz/collection-sync";

type Props = {
	state: PartialSyncState;
	totalCount: number;
	cachedCount: number;
};

function describeState(state: PartialSyncState): string {
	switch (state.status) {
		case "offline":
			return "Offline -- local cache only";
		case "connecting":
			return "Connecting...";
		case "connected":
			return "Connected";
		case "fetching":
			return `Fetching... (chunks ${state.chunksReceived})`;
		case "partial":
			return `${state.cachedCount.toLocaleString()} / ${state.totalCount.toLocaleString()} rows cached (${Math.round(state.cacheUtilization * 100)}% used)`;
		case "realtime":
			return `Live -- ${state.cachedCount.toLocaleString()} / ${state.totalCount.toLocaleString()} cached`;
		case "evicting":
			return `Cache full -- trimming distant rows (${state.evictingCount})...`;
		case "disconnected":
			return `Disconnected -- showing cached data (${state.cachedCount.toLocaleString()} rows)`;
		case "error":
			return `Error: ${state.message}`;
		default:
			return "Unknown";
	}
}

export function SyncStatusBar({ state, totalCount, cachedCount }: Props) {
	const utilization =
		state.status === "partial" || state.status === "realtime"
			? state.cacheUtilization
			: 0;
	return (
		<div style={{ marginTop: 12, padding: 8, background: "#f3f3f3", borderRadius: 6 }}>
			<div>{describeState(state)}</div>
			<div style={{ fontSize: 12, marginTop: 4 }}>
				Cached rows: {cachedCount.toLocaleString()} / {totalCount.toLocaleString()}
			</div>
			<div style={{ marginTop: 6, height: 8, background: "#ddd", borderRadius: 4 }}>
				<div
					style={{
						width: `${Math.min(100, Math.max(0, utilization * 100))}%`,
						height: "100%",
						background: utilization > 0.85 ? "#e44" : utilization > 0.7 ? "#e5a100" : "#2a8f45",
						borderRadius: 4,
					}}
				/>
			</div>
		</div>
	);
}
