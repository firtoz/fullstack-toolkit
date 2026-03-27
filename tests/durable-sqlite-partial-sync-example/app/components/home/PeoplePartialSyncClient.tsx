import { connectPartialSync, type SyncClientMessage } from "@firtoz/collection-sync";
import { useCallback, useLayoutEffect, useState } from "react";
import superjson from "superjson";
import { PeopleVirtualList } from "./PeopleVirtualList";
import { SyncStatusBar } from "./SyncStatusBar";
import type { PeoplePartialSyncCollection, SortState, WsTransport } from "./types";
import { usePartialSyncWindow } from "./usePartialSyncWindow";

const DEFAULT_SORT: SortState = {
	column: "name",
	direction: "asc",
};

type Props = {
	collection: PeoplePartialSyncCollection;
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

	const {
		bridge,
		rows,
		windowStartIndex,
		totalCount,
		loading,
		fetchNext,
		seekToViewport,
		bridgeState,
		viewportInfo,
		setViewportInfo,
		lastSeekMeta,
	} = usePartialSyncWindow({ collection, sort });

	// Must run before any useEffect in usePartialSyncWindow (e.g. initial fetchNext).
	// Otherwise the bridge still has the constructor noop `send` and rangeQuery is dropped.
	useLayoutEffect(() => {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = new URL(
			`${protocol}//${window.location.host}/room/${roomId}/websocket`,
		);
		if (wsTransport === "msgpack") {
			wsUrl.searchParams.set("transport", "msgpack");
		}

		const disconnect = connectPartialSync(bridge, {
			url: wsUrl.toString(),
			transport: wsTransport === "msgpack" ? "msgpack" : "json",
			setTransportSend: (send) => {
				bridge.setSend((message: SyncClientMessage) => send(message));
			},
			serializeJson: (value: unknown) => superjson.stringify(value),
			deserializeJson: (raw: string) => superjson.parse(raw),
		});

		return () => {
			disconnect();
		};
	}, [bridge, roomId, wsTransport]);

	const toggleSort = useCallback(
		(column: "name" | "age") => {
			setSort((prev) => ({
				column,
				direction:
					prev.column === column && prev.direction === "asc" ? "desc" : "asc",
			}));
		},
		[],
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
					{windowStartIndex + rows.length}) · total {totalCount.toLocaleString()}
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
				loading={loading}
				onViewportChange={setViewportInfo}
				onNearEnd={() => {
					void fetchNext();
				}}
				onScrollSettled={(firstVisibleIndex) => {
					seekToViewport(firstVisibleIndex, { scrollSettled: true });
				}}
			/>
		</section>
	);
}
