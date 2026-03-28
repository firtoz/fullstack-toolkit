import type {
	PartialSyncCollection,
	ViewportInfo,
} from "@firtoz/collection-sync/react";
import { usePartialSyncWindow } from "@firtoz/collection-sync/react";
import { useCallback, useMemo, useState } from "react";
import superjson from "superjson";
import { PeopleVirtualList } from "./PeopleVirtualList";
import { SyncStatusBar } from "./SyncStatusBar";
import type { PersonRow, SortState, WsTransport } from "./types";

const superjsonSerializeJson = (value: unknown): string =>
	superjson.stringify(value);
const superjsonDeserializeJson = (raw: string): unknown =>
	superjson.parse(raw);

const getPersonSortValue = (
	row: PersonRow,
	col: SortState["column"],
): unknown => row[col];

const DEFAULT_SORT: SortState = {
	column: "name",
	direction: "asc",
};

type Props = {
	collection: PartialSyncCollection<PersonRow>;
	roomId: string;
	wsTransport: WsTransport;
	label: string;
};

export function PeoplePartialSyncClient({
	collection,
	roomId,
	wsTransport,
	label,
}: Props) {
	const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

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

	return (
		<section style={{ marginTop: 16 }}>
			<h2 style={{ marginBottom: 4 }}>People ({label})</h2>
			<div style={{ display: "flex", gap: 8 }}>
				<button type="button" onClick={() => toggleSort("name")}>
					Sort by name ({sort.column === "name" ? sort.direction : "asc"})
				</button>
				<button type="button" onClick={() => toggleSort("age")}>
					Sort by age ({sort.column === "age" ? sort.direction : "asc"})
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
					server range:{" "}
					{rangeRequestInFlight ? "in flight" : "idle"} (instant cache seeks do
					not set this)
				</div>
				<div>
					last seek: offset {lastSeekMeta?.offset ?? "—"} (
					{lastSeekMeta?.reason ?? "—"}) — rows are derived from the TanStack
					collection; index map + rangeQuery reconcile when possible.
				</div>
			</div>
			<PeopleVirtualList
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
