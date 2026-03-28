import type {
	SyncClientBridge,
	SyncClientMessage,
} from "@firtoz/collection-sync";
import type {
	PartialSyncCollection,
	ViewportInfo,
} from "@firtoz/collection-sync/react";
import { usePartialSyncWindow } from "@firtoz/collection-sync/react";
import type { Collection } from "@tanstack/db";
import { useCallback, useMemo, useState } from "react";
import superjson from "superjson";
import { PeopleVirtualList } from "./PeopleVirtualList";
import { SyncStatusBar } from "./SyncStatusBar";
import type { PeoplePartialSyncRow, SortState, WsTransport } from "./types";

const superjsonSerializeJson = (value: unknown): string =>
	superjson.stringify(value);
const superjsonDeserializeJson = (raw: string): unknown => superjson.parse(raw);

const DEFAULT_SORT: SortState = {
	column: "name",
	direction: "asc",
};

type Props<TItem extends PeoplePartialSyncRow> = {
	collection: Collection<TItem> & PartialSyncCollection<TItem>;
	mutationBridge: SyncClientBridge<TItem>;
	setTransportSend: (send: (msg: SyncClientMessage) => void) => void;
	roomId: string;
	wsTransport: WsTransport;
	label: string;
};

export function PeoplePartialSyncClient<TItem extends PeoplePartialSyncRow>({
	collection,
	mutationBridge,
	setTransportSend,
	roomId,
	wsTransport,
	label,
}: Props<TItem>) {
	const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
	const [demoBusy, setDemoBusy] = useState(false);

	const getPersonSortValue = useCallback(
		(row: TItem, col: SortState["column"]): unknown => row[col],
		[],
	);

	const wsUrl = useMemo(() => {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const url = new URL(
			`${protocol}//${window.location.host}/room/${roomId}/websocket`,
		);
		if (wsTransport === "msgpack") {
			url.searchParams.set("transport", "msgpack");
		}
		return url.toString();
	}, [roomId, wsTransport]);

	const {
		bridge,
		rows,
		windowStartIndex,
		totalCount,
		rangeRequestInFlight,
		getRowSlot,
		fetchNext,
		seekToViewport,
		bridgeState,
		viewportInfo,
		setViewportInfo,
		lastSeekMeta,
	} = usePartialSyncWindow({
		collection,
		sort,
		getSortValue: getPersonSortValue,
		wsUrl,
		wsTransport,
		serializeJson: superjsonSerializeJson,
		deserializeJson: superjsonDeserializeJson,
		partialWindowResetKey: `${label}-${roomId}`,
		mutationBridge,
		mergeTransportSend: setTransportSend,
	});

	const toggleSort = useCallback((column: "name" | "age") => {
		setSort((prev) => ({
			column,
			direction:
				prev.column === column && prev.direction === "asc" ? "desc" : "asc",
		}));
	}, []);

	const handleNearEnd = useCallback(() => {
		void fetchNext();
	}, [fetchNext]);

	const handleViewportChange = useCallback(
		(info: ViewportInfo) => {
			setViewportInfo(info);
			seekToViewport(info.firstVisibleIndex, {
				scrollSettled: false,
				lastVisibleIndex: info.lastVisibleIndex,
			});
		},
		[seekToViewport, setViewportInfo],
	);

	const handleScrollSettled = useCallback(
		(info: ViewportInfo) => {
			seekToViewport(info.firstVisibleIndex, {
				scrollSettled: true,
				lastVisibleIndex: info.lastVisibleIndex,
			});
		},
		[seekToViewport],
	);

	const randomizeServerVisible = useCallback(async () => {
		const seen = new Set<string>();
		const candidates: string[] = [];
		for (
			let i = viewportInfo.firstVisibleIndex;
			i <= viewportInfo.lastVisibleIndex;
			i += 1
		) {
			const r = getRowSlot(i).row;
			if (r === undefined) continue;
			const sid = String(r.id);
			if (seen.has(sid)) continue;
			seen.add(sid);
			candidates.push(sid);
		}
		if (candidates.length === 0) return;
		for (let i = candidates.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[candidates[i], candidates[j]] = [candidates[j], candidates[i]];
		}
		const rowIds = candidates.slice(0, Math.min(5, candidates.length));
		setDemoBusy(true);
		try {
			const res = await fetch(`/room/${roomId}/demo/randomize-visible`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rowIds }),
			});
			if (!res.ok) {
				console.error("demo randomize failed", await res.text());
			}
		} finally {
			setDemoBusy(false);
		}
	}, [getRowSlot, roomId, viewportInfo]);

	return (
		<section style={{ marginTop: 16 }}>
			<h2 style={{ marginBottom: 4 }}>People ({label})</h2>
			<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
				<button type="button" onClick={() => toggleSort("name")}>
					Sort by name ({sort.column === "name" ? sort.direction : "asc"})
				</button>
				<button type="button" onClick={() => toggleSort("age")}>
					Sort by age ({sort.column === "age" ? sort.direction : "asc"})
				</button>
				<button
					type="button"
					disabled={demoBusy}
					onClick={() => {
						void randomizeServerVisible();
					}}
				>
					{demoBusy ? "Randomizing…" : "Random server tweak (≤5 visible)"}
				</button>
			</div>
			<SyncStatusBar
				state={bridgeState}
				totalCount={totalCount}
				cachedCount={bridge.cachedCount}
			/>
			<div
				style={{
					fontSize: 11,
					fontFamily: "monospace",
					color: "#444",
					marginTop: 8,
					lineHeight: 1.4,
				}}
			>
				<div>
					viewport rows (global): [{viewportInfo.firstVisibleIndex},{" "}
					{viewportInfo.lastVisibleIndex}] · dense window: [{windowStartIndex},{" "}
					{windowStartIndex + rows.length}) · total{" "}
					{totalCount.toLocaleString()}
				</div>
				<div>
					server range: {rangeRequestInFlight ? "in flight" : "idle"} (instant
					cache seeks do not set this)
				</div>
				<div>
					last seek: offset {lastSeekMeta?.offset ?? "—"} (
					{lastSeekMeta?.reason ?? "—"}) — rows are derived from the TanStack
					collection; index map + rangeQuery reconcile when possible.
				</div>
			</div>
			<PeopleVirtualList
				collection={collection}
				rows={rows}
				windowStartIndex={windowStartIndex}
				totalCount={totalCount}
				rangeRequestInFlight={rangeRequestInFlight}
				getRowSlot={getRowSlot}
				onViewportChange={handleViewportChange}
				onNearEnd={handleNearEnd}
				onScrollSettled={handleScrollSettled}
			/>
		</section>
	);
}
