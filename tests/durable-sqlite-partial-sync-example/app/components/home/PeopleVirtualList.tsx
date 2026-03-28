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
	loading: boolean;
	onNearEnd: () => void;
	/** Fired on scroll with current visible global row indices (for debug UI). */
	onViewportChange?: (info: ViewportInfo) => void;
	/**
	 * When scrolling settles (`scrollend` or scroll-idle debounce).
	 * Parent runs an offset seek if the viewport is outside the dense row window — does not run mid-scroll
	 * so sequential `onNearEnd` loads are not wiped by repeated seeks.
	 */
	onScrollSettled?: (firstVisibleIndex: number) => void;
};

/** Fallback when `scrollend` is missing: treat scroll as settled after this idle period. */
const SCROLL_SETTLE_DEBOUNCE_MS = 180;

export function PeopleVirtualList({
	rows,
	windowStartIndex,
	totalCount,
	loading,
	onNearEnd,
	onViewportChange,
	onScrollSettled,
}: Props) {
	const parentRef = useRef<HTMLDivElement | null>(null);
	const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const rowVirtualizer = useVirtualizer({
		count: Math.max(totalCount, rows.length),
		getScrollElement: () => parentRef.current,
		estimateSize: () => 34,
		overscan: 16,
	});

	const emitScrollSettled = useCallback(() => {
		const virtualItems = rowVirtualizer.getVirtualItems();
		const first = virtualItems[0];
		if (first === undefined) return;
		onScrollSettled?.(first.index);
	}, [onScrollSettled, rowVirtualizer]);

	const maybeLoadMore = useCallback(() => {
		const virtualItems = rowVirtualizer.getVirtualItems();
		const first = virtualItems[0];
		const last = virtualItems[virtualItems.length - 1];
		if (!last || first === undefined) return;

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

		if (loading) return;

		if (last.index >= loadedEndExclusive - 20) {
			onNearEnd();
		}
	}, [
		loading,
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
					const localIndex = virtualItem.index - windowStartIndex;
					const row =
						localIndex >= 0 && localIndex < rows.length
							? rows[localIndex]
							: undefined;
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
								gridTemplateColumns: "80px 1fr 80px",
								gap: 8,
								alignItems: "center",
								padding: "0 8px",
								borderBottom: "1px solid #eee",
								fontFamily: "monospace",
							}}
						>
							<div>{virtualItem.index + 1}</div>
							{row ? (
								<>
									<div>{row.name}</div>
									<div>{row.age}</div>
								</>
							) : (
								<div style={{ gridColumn: "span 2", color: "#777" }}>
									{loading ? "Loading..." : "Not cached yet"}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
