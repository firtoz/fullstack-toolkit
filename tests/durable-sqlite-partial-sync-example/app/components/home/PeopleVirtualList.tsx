import type {
	PartialSyncRowSlot,
	PartialSyncRowSlotView,
} from "@firtoz/collection-sync/react";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";
import type { PersonRow } from "./types";

export type ViewportInfo = {
	firstVisibleIndex: number;
	lastVisibleIndex: number;
};

type Props = {
	rows: PersonRow[];
	/** Global sort index of `rows[0]` (dense window into the list). */
	windowStartIndex: number;
	totalCount: number;
	/** Server range query in flight — not set for instant cache-only window alignment. */
	rangeRequestInFlight: boolean;
	/** Per global row index: collection row + slot (not tied to dense `rows` window only). */
	getRowSlot: (globalIndex: number) => PartialSyncRowSlotView<PersonRow>;
	onNearEnd: () => void;
	/** Fired on scroll with current visible global row indices (for debug UI). */
	onViewportChange?: (info: ViewportInfo) => void;
	/**
	 * When scrolling settles (`scrollend` or scroll-idle debounce).
	 * Combines `scrollTop` with virtual items: near scroll edges we trust geometry (sudden jump to top
	 * can leave a high virtual first index until the next scroll event).
	 */
	onScrollSettled?: (info: ViewportInfo) => void;
};

/** Fallback when `scrollend` is missing: treat scroll as settled after this idle period. */
const SCROLL_SETTLE_DEBOUNCE_MS = 180;

/** Must match `estimateSize` below; used to map scroll position → row index without overscan noise. */
const ROW_ESTIMATE_PX = 34;

/** Pixels from scroll min/max where we trust `scrollTop` over a stale high `getVirtualItems()[0].index`. */
const NEAR_SCROLL_EDGE_PX = ROW_ESTIMATE_PX * 4;

function rowSlotLabel(slot: PartialSyncRowSlot): string {
	switch (slot) {
		case "ready":
			return "dense";
		case "ready_global":
			return "cache";
		case "stale_map":
			return "stale";
		case "server":
			return "server";
		case "none":
			return "—";
		default:
			exhaustiveGuard(slot);
	}
}

function emptyRowCaption(slot: PartialSyncRowSlot): string {
	switch (slot) {
		case "server":
			return "Fetching range…";
		case "none":
			return "Not mapped yet";
		case "stale_map":
			return "Mapped id, row missing";
		case "ready":
		case "ready_global":
			return "Unexpected empty";
		default:
			exhaustiveGuard(slot);
	}
}

export function PeopleVirtualList({
	rows,
	windowStartIndex,
	totalCount,
	rangeRequestInFlight,
	getRowSlot,
	onNearEnd,
	onViewportChange,
	onScrollSettled,
}: Props) {
	const parentRef = useRef<HTMLDivElement | null>(null);
	const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	/** Last visible range from scroll; `scrollend` may fire before virtualizer catches up. */
	const latestViewportRef = useRef<ViewportInfo>({
		firstVisibleIndex: 0,
		lastVisibleIndex: 0,
	});
	const rowVirtualizer = useVirtualizer({
		count: Math.max(totalCount, rows.length),
		getScrollElement: () => parentRef.current,
		estimateSize: () => ROW_ESTIMATE_PX,
		overscan: 16,
	});

	const emitScrollSettled = useCallback(() => {
		const el = parentRef.current;
		const flush = () => {
			const virtualItems = rowVirtualizer.getVirtualItems();
			const vf = virtualItems[0];
			const vl = virtualItems[virtualItems.length - 1];

			let firstIdx: number;
			let lastIdx: number;
			const maxIdx = totalCount > 0 ? totalCount - 1 : 0;
			if (el !== null && totalCount > 0) {
				const scrollTop = el.scrollTop;
				const geoFirst = Math.min(
					maxIdx,
					Math.max(0, Math.floor(scrollTop / ROW_ESTIMATE_PX)),
				);
				const viewRows = Math.max(
					1,
					Math.ceil(el.clientHeight / ROW_ESTIMATE_PX),
				);
				const vFirstIdx = vf?.index ?? geoFirst;
				const nearTop = scrollTop <= NEAR_SCROLL_EDGE_PX;
				// Jump to top: scrollTop≈0 but vFirst can stay ~900+ until another scroll (sudden jump).
				// Elsewhere vFirst can lag low vs scrollTop — use max(geo, vFirst).
				if (nearTop) {
					firstIdx = geoFirst;
				} else {
					firstIdx = Math.min(maxIdx, Math.max(geoFirst, vFirstIdx));
				}
				lastIdx = Math.min(maxIdx, firstIdx + viewRows);
			} else if (vf !== undefined && vl !== undefined) {
				firstIdx = vf.index;
				lastIdx = vl.index;
			} else {
				firstIdx = latestViewportRef.current.firstVisibleIndex;
				lastIdx = latestViewportRef.current.lastVisibleIndex;
			}

			latestViewportRef.current = {
				firstVisibleIndex: firstIdx,
				lastVisibleIndex: lastIdx,
			};
			onViewportChange?.({
				firstVisibleIndex: firstIdx,
				lastVisibleIndex: lastIdx,
			});
			onScrollSettled?.({
				firstVisibleIndex: firstIdx,
				lastVisibleIndex: lastIdx,
			});
		};
		requestAnimationFrame(() => {
			requestAnimationFrame(flush);
		});
	}, [onScrollSettled, onViewportChange, rowVirtualizer, totalCount]);

	const maybeLoadMore = useCallback(() => {
		const virtualItems = rowVirtualizer.getVirtualItems();
		const first = virtualItems[0];
		const last = virtualItems[virtualItems.length - 1];
		if (!last || first === undefined) return;

		latestViewportRef.current = {
			firstVisibleIndex: first.index,
			lastVisibleIndex: last.index,
		};

		onViewportChange?.({
			firstVisibleIndex: first.index,
			lastVisibleIndex: last.index,
		});

		if (onScrollSettled !== undefined) {
			clearTimeout(settleTimerRef.current);
			settleTimerRef.current = setTimeout(() => {
				settleTimerRef.current = undefined;
				emitScrollSettled();
			}, SCROLL_SETTLE_DEBOUNCE_MS);
		}

		const loadedEndExclusive = windowStartIndex + rows.length;

		if (rangeRequestInFlight) return;

		if (last.index >= loadedEndExclusive - 20) {
			onNearEnd();
		}
	}, [
		rangeRequestInFlight,
		onNearEnd,
		rowVirtualizer,
		rows.length,
		windowStartIndex,
		onViewportChange,
		onScrollSettled,
		emitScrollSettled,
	]);

	useEffect(() => {
		const el = parentRef.current;
		if (el === null || onScrollSettled === undefined) return;
		const onScrollEnd = () => {
			clearTimeout(settleTimerRef.current);
			settleTimerRef.current = undefined;
			emitScrollSettled();
		};
		el.addEventListener("scrollend", onScrollEnd);
		return () => {
			el.removeEventListener("scrollend", onScrollEnd);
		};
	}, [emitScrollSettled, onScrollSettled]);

	return (
		<div
			ref={parentRef}
			onScroll={maybeLoadMore}
			style={{
				height: 520,
				overflow: "auto",
				border: "1px solid #ddd",
				marginTop: 12,
			}}
		>
			<div
				style={{
					height: `${rowVirtualizer.getTotalSize()}px`,
					position: "relative",
				}}
			>
				{rowVirtualizer.getVirtualItems().map((virtualItem) => {
					const { row, slot } = getRowSlot(virtualItem.index);
					return (
						<div
							key={virtualItem.key}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: `${virtualItem.size}px`,
								transform: `translateY(${virtualItem.start}px)`,
								display: "grid",
								gridTemplateColumns: "52px 72px 1fr 40px",
								gap: 8,
								alignItems: "center",
								padding: "0 8px",
								borderBottom: "1px solid #eee",
								fontFamily: "monospace",
							}}
						>
							<div>{virtualItem.index + 1}</div>
							<div
								style={{
									fontSize: 10,
									color:
										slot === "server"
											? "#06c"
											: slot === "ready_global"
												? "#2a6"
												: slot === "stale_map"
													? "#a60"
													: "#666",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}
								title={slot}
							>
								{rowSlotLabel(slot)}
							</div>
							{row !== undefined ? (
								<>
									<div>{row.name}</div>
									<div>{row.age}</div>
								</>
							) : (
								<div style={{ gridColumn: "3 / 5", color: "#777" }}>
									{emptyRowCaption(slot)}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
