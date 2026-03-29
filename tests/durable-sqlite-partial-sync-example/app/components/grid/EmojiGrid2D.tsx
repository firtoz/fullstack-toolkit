import type {
	PartialSyncClientBridge,
	PartialSyncState,
} from "@firtoz/collection-sync";
import type { Collection } from "@tanstack/db";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { SyncStatusBar } from "../home/SyncStatusBar";
import {
	clampViewportToWorld,
	EMOJI_GRID_PREFETCH_UNITS,
	EMOJI_GRID_UNIT_PX,
	EMOJI_GRID_WORLD_SIZE,
	expandViewportForPrefetch,
	type EmojiGridPartialSyncRow,
	pickRandomDemoEmoji,
	type Viewport2D,
} from "./types";

/** Pixels of pointer movement before we treat the gesture as a drag (not a click). */
const DRAG_SLOP_PX = 7;

type Props<TItem extends EmojiGridPartialSyncRow> = {
	collection: Collection<TItem>;
	roomId: string;
	/** Backend label shown in the top overlay. */
	label: string;
	viewport: Viewport2D;
	onViewportChange: (next: Viewport2D) => void;
	viewportItems: TItem[];
	partialBridge: PartialSyncClientBridge<TItem>;
	bridgeState: PartialSyncState;
	totalCountForStatus: number;
	/**
	 * While non-empty, those row ids stay in the partial-sync viewport row set (predicate OR pins).
	 * Set on tile pointer down, clear on pointer up/cancel.
	 */
	onAlwaysIncludeRowIdsChange?: (ids: readonly string[]) => void;
};

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

function scrollRectToViewport(
	scrollLeft: number,
	scrollTop: number,
	clientWidth: number,
	clientHeight: number,
	unitPx: number,
): Viewport2D {
	const u = unitPx;
	const minX = Math.floor(scrollLeft / u);
	const maxX = Math.ceil((scrollLeft + clientWidth) / u) - 1;
	const minY = Math.floor(scrollTop / u);
	const maxY = Math.ceil((scrollTop + clientHeight) / u) - 1;
	return clampViewportToWorld({ minX, maxX, minY, maxY });
}

function clientPointToScrollContent(
	scrollEl: HTMLDivElement,
	clientX: number,
	clientY: number,
): { x: number; y: number } {
	const r = scrollEl.getBoundingClientRect();
	return {
		x: scrollEl.scrollLeft + (clientX - r.left),
		y: scrollEl.scrollTop + (clientY - r.top),
	};
}

const ZOOM_SCALE_MAX = 4;
const WHEEL_ZOOM_STEP = 0.09;

/** World width/height in CSS px when scale === 1. */
const WORLD_SPAN_PX_AT_SCALE_1 = EMOJI_GRID_WORLD_SIZE * EMOJI_GRID_UNIT_PX;

/**
 * Never allow scale below this (avoids degenerate layout if size is unknown).
 */
const ZOOM_ABSOLUTE_MIN = 0.006;

/**
 * Min zoom = this fraction of the scale where the world would exactly fit the
 * smaller viewport dimension — so you can zoom out past “whole grid visible”.
 */
const ZOOM_OUT_PAST_FULL_FIT = 0.38;

function computeMinZoomScale(clientW: number, clientH: number): number {
	const m = Math.min(clientW, clientH);
	if (m < 8 || WORLD_SPAN_PX_AT_SCALE_1 <= 0) return ZOOM_ABSOLUTE_MIN;
	const fitScale = m / WORLD_SPAN_PX_AT_SCALE_1;
	return Math.max(ZOOM_ABSOLUTE_MIN, fitScale * ZOOM_OUT_PAST_FULL_FIT);
}
/** Ignore very short spans so a two-finger tap doesn’t register as a pinch. */
const PINCH_MIN_START_DIST = 14;

/**
 * Per-frame pinch: scale *= (currentDist / lastDist). Using the initial pinch
 * distance as the only anchor fights clamp() at min/max zoom and makes jitter
 * look like wild zoom in/out.
 */
const PINCH_RATIO_DAMPING = 0.78;

function touchPairDistance(t: TouchList): number {
	if (t.length < 2) return 0;
	const a = t.item(0);
	const b = t.item(1);
	if (a === null || b === null) return 0;
	return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function touchPairCenterInElement(
	el: HTMLElement,
	t: TouchList,
): { mx: number; my: number } {
	const r = el.getBoundingClientRect();
	const a = t.item(0);
	const b = t.item(1);
	if (a === null || b === null) return { mx: 0, my: 0 };
	return {
		mx: (a.clientX + b.clientX) / 2 - r.left,
		my: (a.clientY + b.clientY) / 2 - r.top,
	};
}

function healthBarColor(health: number): string {
	if (health >= 70) return "#2a8f45";
	if (health >= 35) return "#e5a100";
	return "#c33";
}

function tileSize(unitPx: number): { w: number; h: number } {
	return {
		w: Math.max(unitPx * 4, 56),
		h: Math.max(unitPx * 5, 72),
	};
}

/** Match server / viewport query ordering (x asc, then y, then id). */
function compareEmojiGridWorldOrder<TItem extends EmojiGridPartialSyncRow>(
	a: TItem,
	b: TItem,
): number {
	if (a.x !== b.x) return a.x - b.x;
	if (a.y !== b.y) return a.y - b.y;
	return String(a.id).localeCompare(String(b.id));
}

export function EmojiGrid2D<TItem extends EmojiGridPartialSyncRow>({
	collection,
	roomId,
	label,
	viewport,
	onViewportChange,
	viewportItems,
	partialBridge,
	bridgeState,
	totalCountForStatus,
	onAlwaysIncludeRowIdsChange,
}: Props<TItem>) {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const [scale, setScale] = useState(1);
	const scaleRef = useRef(scale);
	scaleRef.current = scale;

	const zoomFocalRef = useRef<{
		mx: number;
		my: number;
		prevScale: number;
	} | null>(null);

	const pinchRef = useRef<{ lastDist: number } | null>(null);

	const [demoBusy, setDemoBusy] = useState(false);
	const [flashIds, setFlashIds] = useState(() => new Set<string>());
	const [bottomOverlayOpen, setBottomOverlayOpen] = useState(true);

	type TileDragPayload = {
		row: TItem;
		offsetX: number;
		offsetY: number;
		pointerId: number;
		captureTarget: HTMLElement;
		startClientX: number;
		startClientY: number;
	};

	const collectionRef = useRef(collection);
	collectionRef.current = collection;

	const onAlwaysIncludeRowIdsChangeRef = useRef(onAlwaysIncludeRowIdsChange);
	onAlwaysIncludeRowIdsChangeRef.current = onAlwaysIncludeRowIdsChange;

	const onItemClickRef = useRef<((row: TItem) => Promise<void>) | null>(null);

	const dragPayloadRef = useRef<TileDragPayload | null>(null);
	/** Snapshot of visible tile ids at pointer-down so rapid x/y updates during drag do not drop peers from the live query. */
	const dragRenderBaselineRef = useRef<Map<string, TItem>>(new Map());
	/** Union of all `viewportItems` ids seen while a drag overlay is active (handles tiles that enter then leave the predicate mid-gesture). */
	const dragSeenViewportIdsRef = useRef<Set<string>>(new Set());
	const dragPreviewRef = useRef<{ left: number; top: number }>({
		left: 0,
		top: 0,
	});
	const dragSlopExceededRef = useRef(false);
	const dragGestureEndedRef = useRef(false);

	/** Last (x,y) cell written to the collection during the active drag (live sync). */
	const dragLastPublishedCellRef = useRef<{ x: number; y: number }>({
		x: 0,
		y: 0,
	});
	/** Target cell for the next rAF-throttled `collection.update` (reduces WS/persist load during drag). */
	const dragPendingPublishCellRef = useRef<{ x: number; y: number } | null>(
		null,
	);
	const dragPublishRafIdRef = useRef<number | null>(null);

	const [dragOverlay, setDragOverlay] = useState<{
		left: number;
		top: number;
		row: TItem;
	} | null>(null);

	const minZoomScaleRef = useRef(computeMinZoomScale(800, 600));
	const [minZoomScale, setMinZoomScale] = useState(
		() => minZoomScaleRef.current,
	);

	const unitPx = EMOJI_GRID_UNIT_PX * scale;

	const emitViewport = useCallback(() => {
		const el = scrollRef.current;
		if (el === null) return;
		onViewportChange(
			scrollRectToViewport(
				el.scrollLeft,
				el.scrollTop,
				el.clientWidth,
				el.clientHeight,
				unitPx,
			),
		);
	}, [onViewportChange, unitPx]);

	/**
	 * Must run before the emitViewport layout effect on the same commit so scroll positions
	 * match the new scale when we convert pixels → world units.
	 */
	useLayoutEffect(() => {
		const el = scrollRef.current;
		if (el === null) return;
		const focal = zoomFocalRef.current;
		if (focal !== null) {
			zoomFocalRef.current = null;
			const oldUnit = EMOJI_GRID_UNIT_PX * focal.prevScale;
			const newUnit = EMOJI_GRID_UNIT_PX * scale;
			const worldX = (el.scrollLeft + focal.mx) / oldUnit;
			const worldY = (el.scrollTop + focal.my) / oldUnit;
			el.scrollLeft = worldX * newUnit - focal.mx;
			el.scrollTop = worldY * newUnit - focal.my;
		}
		const maxL = Math.max(0, el.scrollWidth - el.clientWidth);
		const maxT = Math.max(0, el.scrollHeight - el.clientHeight);
		el.scrollLeft = Math.max(0, Math.min(maxL, el.scrollLeft));
		el.scrollTop = Math.max(0, Math.min(maxT, el.scrollTop));
	}, [scale]);

	useLayoutEffect(() => {
		emitViewport();
	}, [emitViewport]);

	useLayoutEffect(() => {
		setScale((s) => Math.min(ZOOM_SCALE_MAX, Math.max(minZoomScale, s)));
	}, [minZoomScale]);

	useEffect(() => {
		const el = scrollRef.current;
		if (el === null) return;
		const syncMinZoomFromEl = () => {
			const next = computeMinZoomScale(el.clientWidth, el.clientHeight);
			minZoomScaleRef.current = next;
			setMinZoomScale(next);
			emitViewport();
		};
		const ro = new ResizeObserver(() => {
			syncMinZoomFromEl();
		});
		ro.observe(el);
		syncMinZoomFromEl();
		return () => {
			ro.disconnect();
		};
	}, [emitViewport]);

	useEffect(() => {
		const el = scrollRef.current;
		if (el === null) return;

		const clampZoom = (s: number) =>
			Math.min(ZOOM_SCALE_MAX, Math.max(minZoomScaleRef.current, s));

		const onWheel = (e: WheelEvent) => {
			const zoomGesture = e.ctrlKey || e.metaKey;
			if (zoomGesture) {
				e.preventDefault();
				const rect = el.getBoundingClientRect();
				const mx = e.clientX - rect.left;
				const my = e.clientY - rect.top;
				const prevScale = scaleRef.current;
				const direction = e.deltaY > 0 ? -1 : 1;
				const nextScale = clampZoom(
					prevScale * (1 + direction * WHEEL_ZOOM_STEP),
				);
				if (nextScale === prevScale) return;
				zoomFocalRef.current = { mx, my, prevScale };
				setScale(nextScale);
				return;
			}

			// At scroll extremes, block wheel from chaining to the document (history swipe, etc.).
			const maxL = Math.max(0, el.scrollWidth - el.clientWidth);
			const maxT = Math.max(0, el.scrollHeight - el.clientHeight);
			const dx = e.shiftKey ? e.deltaY : e.deltaX;
			const dy = e.shiftKey ? 0 : e.deltaY;
			if (dx < 0 && el.scrollLeft <= 0) e.preventDefault();
			if (dx > 0 && el.scrollLeft >= maxL) e.preventDefault();
			if (dy < 0 && el.scrollTop <= 0) e.preventDefault();
			if (dy > 0 && el.scrollTop >= maxT) e.preventDefault();
		};

		el.addEventListener("wheel", onWheel, { passive: false });

		const onTouchStart = (e: TouchEvent) => {
			if (e.touches.length === 2) {
				const d = touchPairDistance(e.touches);
				if (d >= PINCH_MIN_START_DIST) {
					pinchRef.current = { lastDist: d };
				}
			}
		};

		const onTouchMove = (e: TouchEvent) => {
			if (e.touches.length !== 2 || pinchRef.current === null) return;
			const d = touchPairDistance(e.touches);
			if (d < PINCH_MIN_START_DIST * 0.5) return;
			e.preventDefault();
			const lastDist = pinchRef.current.lastDist;
			if (lastDist < PINCH_MIN_START_DIST * 0.5) return;
			const rawRatio = d / lastDist;
			const ratio = 1 + (rawRatio - 1) * PINCH_RATIO_DAMPING;
			const prevScale = scaleRef.current;
			const nextScale = clampZoom(prevScale * ratio);
			pinchRef.current.lastDist = d;
			if (Math.abs(nextScale - prevScale) < 1e-6) return;
			const { mx, my } = touchPairCenterInElement(el, e.touches);
			zoomFocalRef.current = { mx, my, prevScale };
			setScale(nextScale);
		};

		const endPinch = () => {
			pinchRef.current = null;
		};

		el.addEventListener("touchstart", onTouchStart, { passive: true });
		el.addEventListener("touchmove", onTouchMove, { passive: false });
		el.addEventListener("touchend", endPinch);
		el.addEventListener("touchcancel", endPinch);

		return () => {
			el.removeEventListener("wheel", onWheel);
			el.removeEventListener("touchstart", onTouchStart);
			el.removeEventListener("touchmove", onTouchMove);
			el.removeEventListener("touchend", endPinch);
			el.removeEventListener("touchcancel", endPinch);
		};
	}, []);

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

	const onItemClick = useCallback(
		async (row: TItem) => {
			const tx = collection.update(row.id, (d) => {
				d.emoji = pickRandomDemoEmoji();
				d.health = Math.floor(Math.random() * 101);
				d.updatedAt = new Date();
			});
			await tx.isPersisted.promise;
		},
		[collection],
	);
	onItemClickRef.current = onItemClick;

	const onTilePointerDown = useCallback(
		(e: ReactPointerEvent<HTMLButtonElement>, row: TItem) => {
			if (e.button !== 0) return;
			const scrollEl = scrollRef.current;
			if (scrollEl === null) return;
			const content = clientPointToScrollContent(
				scrollEl,
				e.clientX,
				e.clientY,
			);
			const tileLeft = row.x * unitPx;
			const tileTop = row.y * unitPx;
			dragGestureEndedRef.current = false;
			dragSlopExceededRef.current = false;
			dragLastPublishedCellRef.current = { x: row.x, y: row.y };
			dragPendingPublishCellRef.current = null;
			if (dragPublishRafIdRef.current !== null) {
				cancelAnimationFrame(dragPublishRafIdRef.current);
				dragPublishRafIdRef.current = null;
			}
			dragPayloadRef.current = {
				row,
				offsetX: content.x - tileLeft,
				offsetY: content.y - tileTop,
				pointerId: e.pointerId,
				/** Capture on the scroll surface so the gesture survives if the tile unmounts (viewport predicate). */
				captureTarget: scrollEl,
				startClientX: e.clientX,
				startClientY: e.clientY,
			};
			dragPreviewRef.current = { left: tileLeft, top: tileTop };
			const baseline = new Map<string, TItem>();
			const seenIds = new Set<string>();
			for (const r of viewportItems) {
				const sid = String(r.id);
				baseline.set(sid, r);
				seenIds.add(sid);
			}
			dragRenderBaselineRef.current = baseline;
			dragSeenViewportIdsRef.current = seenIds;
			setDragOverlay({ left: tileLeft, top: tileTop, row });
			onAlwaysIncludeRowIdsChangeRef.current?.([String(row.id)]);
			scrollEl.setPointerCapture(e.pointerId);
		},
		[unitPx, viewportItems],
	);

	useEffect(() => {
		if (dragOverlay === null) return;
		const payloadAtStart = dragPayloadRef.current;
		if (payloadAtStart === null) return;

		const onMove = (e: PointerEvent) => {
			if (e.pointerId !== payloadAtStart.pointerId) return;
			const scrollEl = scrollRef.current;
			if (scrollEl === null) return;
			const u = EMOJI_GRID_UNIT_PX * scaleRef.current;
			const wp = EMOJI_GRID_WORLD_SIZE * u;
			const { w: tw, h: th } = tileSize(u);
			const c = clientPointToScrollContent(scrollEl, e.clientX, e.clientY);
			let left = c.x - payloadAtStart.offsetX;
			let top = c.y - payloadAtStart.offsetY;
			left = Math.max(0, Math.min(wp - tw, left));
			top = Math.max(0, Math.min(wp - th, top));
			if (!dragSlopExceededRef.current) {
				const d = Math.hypot(
					e.clientX - payloadAtStart.startClientX,
					e.clientY - payloadAtStart.startClientY,
				);
				if (d >= DRAG_SLOP_PX) dragSlopExceededRef.current = true;
			}
			dragPreviewRef.current = { left, top };
			setDragOverlay((prev) => (prev === null ? null : { ...prev, left, top }));

			if (dragSlopExceededRef.current) {
				const nx = Math.max(
					0,
					Math.min(EMOJI_GRID_WORLD_SIZE - 1, Math.round(left / u)),
				);
				const ny = Math.max(
					0,
					Math.min(EMOJI_GRID_WORLD_SIZE - 1, Math.round(top / u)),
				);
				const lp = dragLastPublishedCellRef.current;
				if (nx !== lp.x || ny !== lp.y) {
					dragPendingPublishCellRef.current = { x: nx, y: ny };
					if (dragPublishRafIdRef.current !== null) return;
					dragPublishRafIdRef.current = requestAnimationFrame(() => {
						dragPublishRafIdRef.current = null;
						if (dragGestureEndedRef.current) return;
						const cell = dragPendingPublishCellRef.current;
						dragPendingPublishCellRef.current = null;
						if (cell === null) return;
						const lpInner = dragLastPublishedCellRef.current;
						if (cell.x === lpInner.x && cell.y === lpInner.y) return;
						dragLastPublishedCellRef.current = {
							x: cell.x,
							y: cell.y,
						};
						const coll = collectionRef.current;
						const pl = dragPayloadRef.current;
						if (pl === null) return;
						const tx = coll.update(pl.row.id, (d) => {
							d.x = cell.x;
							d.y = cell.y;
							d.updatedAt = new Date();
						});
						void tx.isPersisted.promise;
					});
				}
			}
		};

		const finish = (e: PointerEvent) => {
			if (e.pointerId !== payloadAtStart.pointerId) return;
			if (dragGestureEndedRef.current) return;
			dragGestureEndedRef.current = true;

			const payload = dragPayloadRef.current;
			const pos = dragPreviewRef.current;

			if (dragPublishRafIdRef.current !== null) {
				cancelAnimationFrame(dragPublishRafIdRef.current);
				dragPublishRafIdRef.current = null;
			}
			const flushed = dragPendingPublishCellRef.current;
			dragPendingPublishCellRef.current = null;
			if (payload !== null && dragSlopExceededRef.current && flushed !== null) {
				const lp0 = dragLastPublishedCellRef.current;
				if (flushed.x !== lp0.x || flushed.y !== lp0.y) {
					dragLastPublishedCellRef.current = {
						x: flushed.x,
						y: flushed.y,
					};
					const coll = collectionRef.current;
					const tx = coll.update(payload.row.id, (d) => {
						d.x = flushed.x;
						d.y = flushed.y;
						d.updatedAt = new Date();
					});
					void tx.isPersisted.promise;
				}
			}

			const u = EMOJI_GRID_UNIT_PX * scaleRef.current;
			const nx = Math.max(
				0,
				Math.min(EMOJI_GRID_WORLD_SIZE - 1, Math.round(pos.left / u)),
			);
			const ny = Math.max(
				0,
				Math.min(EMOJI_GRID_WORLD_SIZE - 1, Math.round(pos.top / u)),
			);

			/** Apply final cell before clearing pins / overlay so the list never paints a stale grid position for one frame. */
			if (payload !== null && dragSlopExceededRef.current) {
				const lp = dragLastPublishedCellRef.current;
				if (nx !== lp.x || ny !== lp.y) {
					dragLastPublishedCellRef.current = { x: nx, y: ny };
					const coll = collectionRef.current;
					const tx = coll.update(payload.row.id, (d) => {
						d.x = nx;
						d.y = ny;
						d.updatedAt = new Date();
					});
					void tx.isPersisted.promise;
				}
			} else if (payload !== null && !dragSlopExceededRef.current) {
				const runClick = onItemClickRef.current;
				if (runClick !== null) void runClick(payload.row);
			}

			onAlwaysIncludeRowIdsChangeRef.current?.([]);
			try {
				payloadAtStart.captureTarget.releasePointerCapture(e.pointerId);
			} catch {
				// Already released or target detached
			}
			dragPayloadRef.current = null;
			dragRenderBaselineRef.current = new Map();
			dragSeenViewportIdsRef.current = new Set();
			setDragOverlay(null);
		};

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", finish);
		window.addEventListener("pointercancel", finish);

		return () => {
			if (dragPublishRafIdRef.current !== null) {
				cancelAnimationFrame(dragPublishRafIdRef.current);
				dragPublishRafIdRef.current = null;
			}
			dragPendingPublishCellRef.current = null;
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", finish);
			window.removeEventListener("pointercancel", finish);
		};
	}, [dragOverlay?.row.id]);

	useLayoutEffect(() => {
		if (dragOverlay === null) return;
		const seen = dragSeenViewportIdsRef.current;
		for (const r of viewportItems) {
			seen.add(String(r.id));
		}
	}, [dragOverlay, viewportItems]);

	const randomizeServerVisible = useCallback(async () => {
		const candidates = viewportItems.map((r) => String(r.id));
		if (candidates.length === 0) return;
		for (let i = candidates.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[candidates[i], candidates[j]] = [candidates[j], candidates[i]];
		}
		const rowIds = candidates.slice(0, Math.min(5, candidates.length));
		setDemoBusy(true);
		try {
			const res = await fetch(`/grid/${roomId}/demo/randomize-visible`, {
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
	}, [roomId, viewportItems]);

	const tilesToRender = useMemo(() => {
		const ids = new Set<string>();
		for (const r of viewportItems) ids.add(String(r.id));
		if (dragOverlay !== null) {
			for (const id of dragRenderBaselineRef.current.keys()) ids.add(id);
			for (const id of dragSeenViewportIdsRef.current) ids.add(id);
		}
		const merged: TItem[] = [];
		for (const id of ids) {
			const live =
				collection.get(id) ??
				(Number.isFinite(Number(id)) ? collection.get(Number(id)) : undefined);
			if (live !== undefined) merged.push(live);
		}
		merged.sort(compareEmojiGridWorldOrder);
		return merged;
	}, [collection, dragOverlay, viewportItems]);

	const worldPx = EMOJI_GRID_WORLD_SIZE * unitPx;
	const { w: tileW, h: tileH } = tileSize(unitPx);
	const rangeBusy = bridgeState.status === "fetching";

	const emojiTileBody = (r: TItem) => (
		<>
			<div
				style={{
					fontSize: 22,
					lineHeight: 1,
					textAlign: "center",
				}}
			>
				{r.emoji}
			</div>
			<div
				style={{
					fontSize: 10,
					color: "#333",
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{r.name}
			</div>
			<div
				style={{
					height: 6,
					background: "#e8e8e8",
					borderRadius: 3,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						width: `${Math.min(100, Math.max(0, r.health))}%`,
						height: "100%",
						background: healthBarColor(r.health),
						borderRadius: 3,
					}}
				/>
			</div>
			<div
				style={{
					fontSize: 9,
					color: "#666",
					textAlign: "right",
				}}
			>
				{r.health}
			</div>
		</>
	);
	const prefetchViewport = expandViewportForPrefetch(
		viewport,
		EMOJI_GRID_PREFETCH_UNITS,
	);

	const overlayPanelStyle: CSSProperties = {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		zIndex: 15,
		padding: 10,
		display: "flex",
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "flex-end",
		justifyContent: "flex-start",
		gap: 8,
		pointerEvents: "none",
	};

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				overflow: "hidden",
				fontFamily: "sans-serif",
				overscrollBehavior: "none",
			}}
		>
			<style>
				{
					"@keyframes eg2d-highlight { from { box-shadow: 0 0 0 3px rgba(40, 200, 90, 0.55); } to { box-shadow: none; } }"
				}
			</style>
			<div style={overlayPanelStyle}>
				{bottomOverlayOpen ? (
					<div
						style={{
							pointerEvents: "auto",
							maxWidth: "min(100%, 560px)",
							padding: "8px 10px",
							borderRadius: 8,
							background: "rgba(255, 255, 255, 0.92)",
							boxShadow: "0 -2px 16px rgba(0,0,0,0.08)",
							border: "1px solid rgba(0,0,0,0.06)",
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								gap: 8,
								marginBottom: 6,
							}}
						>
							<span style={{ fontSize: 13, fontWeight: 600 }}>
								Emoji grid ({label})
							</span>
							<button
								type="button"
								onClick={() => {
									setBottomOverlayOpen(false);
								}}
							>
								Hide
							</button>
						</div>
						<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
							<button
								type="button"
								disabled={demoBusy || viewportItems.length === 0}
								onClick={() => {
									void randomizeServerVisible();
								}}
							>
								{demoBusy
									? "Randomizing…"
									: "Random server tweak (≤5 in viewport)"}
							</button>
						</div>
						<div style={{ marginTop: 8 }}>
							<SyncStatusBar
								state={bridgeState}
								totalCount={totalCountForStatus}
								cachedCount={partialBridge.cachedCount}
								serverWindowRowCount={partialBridge.serverConfirmedKeys.size}
							/>
						</div>
						<div
							style={{
								fontSize: 11,
								fontFamily: "monospace",
								color: "#444",
								marginTop: 8,
								lineHeight: 1.45,
							}}
						>
							<div>
								visible (world) x:[{viewport.minX}, {viewport.maxX}] y:[
								{viewport.minY}, {viewport.maxY}] · tiles in view:{" "}
								{viewportItems.length}
							</div>
							<div>
								fetch+prefetch ±{EMOJI_GRID_PREFETCH_UNITS} x:[
								{prefetchViewport.minX}, {prefetchViewport.maxX}] y:[
								{prefetchViewport.minY}, {prefetchViewport.maxY}]
							</div>
							<div>
								range: {rangeBusy ? "in flight" : "idle"} · world{" "}
								{EMOJI_GRID_WORLD_SIZE}×{EMOJI_GRID_WORLD_SIZE} · zoom{" "}
								{Math.round(scale * 100)}%
							</div>
							<div style={{ fontSize: 10, color: "#666" }}>
								Drag tiles to move (cell position syncs while you drag). Tap
								without dragging to randomize. Ctrl+scroll or pinch to zoom.
							</div>
						</div>
					</div>
				) : (
					<button
						type="button"
						style={{ pointerEvents: "auto" }}
						onClick={() => {
							setBottomOverlayOpen(true);
						}}
					>
						Show grid panel
					</button>
				)}
			</div>
			<div
				ref={scrollRef}
				onScroll={emitViewport}
				style={{
					position: "absolute",
					inset: 0,
					overflow: "auto",
					overscrollBehavior: "none",
					touchAction: "pan-x pan-y",
				}}
			>
				<div
					style={{
						width: worldPx,
						height: worldPx,
						position: "relative",
						background:
							"linear-gradient(90deg, #f8f8f8 1px, transparent 1px), linear-gradient(#f0f0f0 1px, transparent 1px)",
						backgroundSize: `${unitPx}px ${unitPx}px`,
					}}
				>
					{tilesToRender.map((row) => {
						const flash = flashIds.has(String(row.id));
						const left = row.x * unitPx;
						const top = row.y * unitPx;
						const draggingThis =
							dragOverlay !== null &&
							String(dragOverlay.row.id) === String(row.id);
						return (
							<button
								key={String(row.id)}
								type="button"
								onPointerDown={(e) => {
									onTilePointerDown(e, row);
								}}
								style={{
									position: "absolute",
									left,
									top,
									width: tileW,
									minHeight: tileH,
									padding: 4,
									display: "flex",
									flexDirection: "column",
									alignItems: "stretch",
									gap: 2,
									border: "1px solid #bbb",
									borderRadius: 6,
									background: "#fff",
									cursor: "grab",
									textAlign: "left",
									font: "inherit",
									boxSizing: "border-box",
									touchAction: "none",
									...(draggingThis ? { visibility: "hidden" as const } : {}),
									...(flash
										? { animation: "eg2d-highlight 1.15s ease-out" }
										: {}),
								}}
							>
								{emojiTileBody(row)}
							</button>
						);
					})}
					{dragOverlay !== null ? (
						<div
							role="presentation"
							style={{
								position: "absolute",
								left: dragOverlay.left,
								top: dragOverlay.top,
								width: tileW,
								minHeight: tileH,
								padding: 4,
								display: "flex",
								flexDirection: "column",
								alignItems: "stretch",
								gap: 2,
								border: "1px solid #888",
								borderRadius: 6,
								background: "#fff",
								cursor: "grabbing",
								textAlign: "left",
								font: "inherit",
								boxSizing: "border-box",
								zIndex: 25,
								pointerEvents: "none",
								boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
							}}
						>
							{emojiTileBody(dragOverlay.row)}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
