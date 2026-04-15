import type { VpMessage } from "./vp-ws-protocol";

const newMessageBodyRe =
	/^New message (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/;

export type VpMessageSortable = Pick<VpMessage, "id" | "body">;

/**
 * Same ordering as {@link sortVpMessagesForDisplay}, for live-query row shapes that
 * only expose `id` + `body` (plus extra fields preserved on each row).
 */
export function sortVpMessageRowsForDisplay<T extends VpMessageSortable>(
	rows: readonly T[],
): T[] {
	return [...rows].sort((a, b) => {
		const ka = vpMessageSortKey(a);
		const kb = vpMessageSortKey(b);
		if (ka !== kb) return ka - kb;
		return a.id.localeCompare(b.id);
	});
}

/**
 * Stable display order for virtual-props demo rows: seed first, then by timestamp
 * embedded in `New message …` bodies, then by id. Use when the store returns rows in
 * arbitrary order (TanStack collection / SQLite without ORDER BY).
 */
export function sortVpMessagesForDisplay(
	rows: readonly VpMessage[],
): VpMessage[] {
	return sortVpMessageRowsForDisplay(rows);
}

function vpMessageSortKey(m: VpMessageSortable): number {
	if (m.body === "Seed message (synced)") {
		return Number.MIN_SAFE_INTEGER;
	}
	const matched = newMessageBodyRe.exec(m.body);
	if (matched) {
		const t = Date.parse(matched[1]);
		if (!Number.isNaN(t)) return t;
	}
	return 0;
}
