import type { PartialSyncItem } from "@firtoz/collection-sync/react";
import type { WsTransport } from "../home/types";

export type { WsTransport };

export { EMOJI_GRID_PARTIAL_SYNC_COLLECTION_ID } from "../../../src/partial-sync-collection-ids";

/** World spans [0, WORLD_SIZE) in x and y (integer cell coordinates). */
export const EMOJI_GRID_WORLD_SIZE = 1000;

/** Pixels per world unit for the scrollable canvas. */
export const EMOJI_GRID_UNIT_PX = 14;

/**
 * Fallback visible span in world units before the first layout measurement
 * (fullscreen scroll surface measures real size immediately after mount).
 */
export const EMOJI_GRID_VIEWPORT_UNITS = 50;

/** Extra world units to request beyond the visible rect (prefetch band). */
export const EMOJI_GRID_PREFETCH_UNITS = 12;

/** Max rows returned for predicate filter / server query (1000 entities, sparse viewport). */
export const EMOJI_GRID_PREDICATE_LIMIT = 2500;

export type Viewport2D = {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
};

/** Row shape for emoji grid partial sync (memory collection + server). */
export type EmojiGridPartialSyncRow = PartialSyncItem & {
	x: number;
	y: number;
	emoji: string;
	name: string;
	health: number;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
};

export type EmojiGridSortColumn = "x" | "y";

export const DEMO_EMOJIS = [
	"😀",
	"😺",
	"🐶",
	"🦊",
	"🐸",
	"🐼",
	"🦁",
	"🐯",
	"🐻",
	"🐨",
	"🐵",
	"🦄",
	"🐝",
	"🦋",
	"🐢",
	"🐙",
	"🦑",
	"🌸",
	"🌲",
	"⭐",
	"🌙",
	"⚡",
	"🔥",
	"💧",
	"🎮",
	"🎸",
	"🎨",
	"🚀",
	"🛸",
	"🍕",
	"🍦",
] as const;

export function pickRandomDemoEmoji(): string {
	return DEMO_EMOJIS[Math.floor(Math.random() * DEMO_EMOJIS.length)] ?? "😀";
}

export function clampViewportToWorld(bounds: Viewport2D): Viewport2D {
	const max = EMOJI_GRID_WORLD_SIZE - 1;
	let { minX, maxX, minY, maxY } = bounds;
	minX = Math.max(0, Math.min(max, minX));
	maxX = Math.max(0, Math.min(max, maxX));
	minY = Math.max(0, Math.min(max, minY));
	maxY = Math.max(0, Math.min(max, maxY));
	if (minX > maxX) {
		const t = minX;
		minX = maxX;
		maxX = t;
	}
	if (minY > maxY) {
		const t = minY;
		minY = maxY;
		maxY = t;
	}
	return { minX, maxX, minY, maxY };
}

export function expandViewportForPrefetch(
	bounds: Viewport2D,
	padCells: number,
): Viewport2D {
	return clampViewportToWorld({
		minX: bounds.minX - padCells,
		maxX: bounds.maxX + padCells,
		minY: bounds.minY - padCells,
		maxY: bounds.maxY + padCells,
	});
}
