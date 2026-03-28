import type {
	PartialSyncRowSlot,
	PartialSyncRowSlotView,
} from "@firtoz/collection-sync/react";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { Collection } from "@tanstack/db";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PeoplePartialSyncRow } from "./types";

export type ViewportInfo = {
	firstVisibleIndex: number;
	lastVisibleIndex: number;
};

type Props<TItem extends PeoplePartialSyncRow> = {
	collection: Collection<TItem>;
	rows: TItem[];
	windowStartIndex: number;
	totalCount: number;
	rangeRequestInFlight: boolean;
	getRowSlot: (globalIndex: number) => PartialSyncRowSlotView<TItem>;
	onNearEnd: () => void;
	onViewportChange?: (info: ViewportInfo) => void;
	onScrollSettled?: (info: ViewportInfo) => void;
};

const SCROLL_SETTLE_DEBOUNCE_MS = 180;
const ROW_ESTIMATE_PX = 34;
const NEAR_SCROLL_EDGE_PX = ROW_ESTIMATE_PX * 4;

function formatTs(value: Date | number | null | undefined): string {
	if (value === null || value === undefined) return "—";
	const d = value instanceof Date ? value : new Date(value);
	return d.toISOString().slice(0, 19).replace("T", " ");
}

function extractTouchIds(changes: unknown[]): string[] {
	const s = new Set<string>();
	const visit = (v: unknown) => {
		if (v === null || typeof v !== "object") return;
		const o = v as Record<string, unknown>;
		if (typeof o.id === "string") s.add(o.id);
		if (typeof o.key === "string" || typeof o.key === "number") {
			s.add(String(o.key));
		}
	};
	for (const c of changes) {
		visit(c);
		if (c !== null && typeof c === "object" && "modified" in c) {
			visit((c as { modified: unknown }).modified);
		}
	}
	return [...s];
}

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

export function PeopleVirtualList<TItem extends PeoplePartialSyncRow>({
	collection,
	rows,
	windowStartIndex,
	totalCount,
	rangeRequestInFlight,
	getRowSlot,
	onNearEnd,
	onViewportChange,
	onScrollSettled,
}: Props<TItem>) {
	const parentRef = useRef<HTMLDivElement | null>(null);
	const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const latestViewportRef = useRef<ViewportInfo>({
		firstVisibleIndex: 0,
		lastVisibleIndex: 0,
	});
	const [editing, setEditing] = useState<
		| {
				id: TItem["id"];
				field: "name" | "age";
				draft: string;
		  }
		| undefined
	>(undefined);
	const [flashIds, setFlashIds] = useState(() => new Set<string>());

	useEffect(() => {
		const sub = collection.subscribeChanges((changes) => {
			const ids = extractTouchIds(changes);
			if (ids.length === 0) return;
			setFlashIds((prev) => {
				const n = new Set(prev);
				for (const id of ids) n.add(id);
				return n;
			});
			for (const id of ids) {
				window.setTimeout(() => {
					setFlashIds((prev) => {
						const n = new Set(prev);
						n.delete(id);
						return n;
					});
				}, 1150);
			}
		});
		return () => {
			sub.unsubscribe();
		};
	}, [collection]);

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

	const commitEdit = useCallback(async () => {
		if (editing === undefined) return;
		const { id, field, draft } = editing;
		if (field === "name") {
			const trimmed = draft.trim();
			if (trimmed.length === 0) {
				setEditing(undefined);
				return;
			}
			const tx = collection.update(id, (d) => {
				d.name = trimmed;
				d.updatedAt = new Date();
			});
			await tx.isPersisted.promise;
		} else {
			const n = Number(draft);
			if (!Number.isFinite(n) || n < 0 || n > 150) {
				setEditing(undefined);
				return;
			}
			const tx = collection.update(id, (d) => {
				d.age = Math.floor(n);
				d.updatedAt = new Date();
			});
			await tx.isPersisted.promise;
		}
		setEditing(undefined);
	}, [collection, editing]);

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
			<style>
				{
					"@keyframes psv-row-highlight { from { background-color: rgba(40, 200, 90, 0.3); } to { background-color: transparent; } }"
				}
			</style>
			<div
				style={{
					height: `${rowVirtualizer.getTotalSize()}px`,
					position: "relative",
				}}
			>
				{rowVirtualizer.getVirtualItems().map((virtualItem) => {
					const { row, slot } = getRowSlot(virtualItem.index);
					const flash = row !== undefined && flashIds.has(String(row.id ?? ""));
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
								gridTemplateColumns:
									"44px 56px minmax(72px,1fr) 36px 100px 100px",
								gap: 6,
								alignItems: "center",
								padding: "0 6px",
								borderBottom: "1px solid #eee",
								fontFamily: "monospace",
								fontSize: 12,
								...(flash
									? {
											animation: "psv-row-highlight 1.15s ease-out",
										}
									: {}),
							}}
						>
							<div>{virtualItem.index + 1}</div>
							<div
								style={{
									fontSize: 9,
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
									{editing?.id === row.id && editing.field === "name" ? (
										<input
											autoFocus
											value={editing.draft}
											onChange={(e) =>
												setEditing({
													id: row.id,
													field: "name",
													draft: e.target.value,
												})
											}
											onBlur={() => {
												void commitEdit();
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter") void commitEdit();
												if (e.key === "Escape") setEditing(undefined);
											}}
											style={{ width: "100%", font: "inherit" }}
										/>
									) : (
										<button
											type="button"
											onClick={() =>
												setEditing({
													id: row.id,
													field: "name",
													draft: row.name,
												})
											}
											style={{
												textAlign: "left",
												border: "none",
												background: "transparent",
												cursor: "pointer",
												font: "inherit",
												padding: 0,
											}}
										>
											{row.name}
										</button>
									)}
									{editing?.id === row.id && editing.field === "age" ? (
										<input
											autoFocus
											type="number"
											value={editing.draft}
											onChange={(e) =>
												setEditing({
													id: row.id,
													field: "age",
													draft: e.target.value,
												})
											}
											onBlur={() => {
												void commitEdit();
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter") void commitEdit();
												if (e.key === "Escape") setEditing(undefined);
											}}
											style={{ width: "100%", font: "inherit" }}
										/>
									) : (
										<button
											type="button"
											onClick={() =>
												setEditing({
													id: row.id,
													field: "age",
													draft: String(row.age),
												})
											}
											style={{
												textAlign: "left",
												border: "none",
												background: "transparent",
												cursor: "pointer",
												font: "inherit",
												padding: 0,
											}}
										>
											{row.age}
										</button>
									)}
									<div style={{ fontSize: 10, color: "#444" }}>
										{formatTs(row.createdAt)}
									</div>
									<div style={{ fontSize: 10, color: "#444" }}>
										{formatTs(row.updatedAt)}
									</div>
								</>
							) : (
								<div style={{ gridColumn: "3 / 7", color: "#777" }}>
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
