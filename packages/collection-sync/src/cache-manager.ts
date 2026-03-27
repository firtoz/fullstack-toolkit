export interface CacheStorageEstimate {
	usageBytes: number;
	quotaBytes: number;
	utilizationRatio: number;
}

export type CacheEntry = {
	key: string | number;
	lastAccessedAt: number;
	fetchedAt: number;
	sortPositions: Map<string, unknown>;
	estimatedSizeBytes: number;
};

export interface CacheManagerOptions<TItem extends { id: string | number }> {
	evictionThreshold?: number;
	evictionTarget?: number;
	estimateRowSize?: (row: TItem) => number;
	getStorageEstimate: () => Promise<CacheStorageEstimate>;
	deleteRows: (keys: Array<string | number>) => Promise<void>;
}

export type CacheViewport = {
	sortColumn: string;
	sortDirection: "asc" | "desc";
	fromValue: unknown;
	toValue: unknown;
};

export class CacheManager<TItem extends { id: string | number }> {
	#entries = new Map<string | number, CacheEntry>();
	readonly evictionThreshold: number;
	readonly evictionTarget: number;

	constructor(private readonly options: CacheManagerOptions<TItem>) {
		this.evictionThreshold = options.evictionThreshold ?? 0.85;
		this.evictionTarget = options.evictionTarget ?? 0.7;
	}

	get entryCount(): number {
		return this.#entries.size;
	}

	recordFetchedRows(
		rows: TItem[],
		getSortPositions: (row: TItem) => Record<string, unknown>,
	): void {
		const now = Date.now();
		for (const row of rows) {
			const existing = this.#entries.get(row.id);
			const sortPositionsObject = getSortPositions(row);
			const sortPositions = new Map<string, unknown>(
				Object.entries(sortPositionsObject),
			);
			const estimatedSizeBytes = this.options.estimateRowSize?.(row) ?? 256;
			this.#entries.set(row.id, {
				key: row.id,
				lastAccessedAt: existing?.lastAccessedAt ?? now,
				fetchedAt: now,
				sortPositions,
				estimatedSizeBytes,
			});
		}
	}

	markAccessed(keys: Array<string | number>): void {
		const now = Date.now();
		for (const key of keys) {
			const entry = this.#entries.get(key);
			if (!entry) continue;
			entry.lastAccessedAt = now;
		}
	}

	removeEntries(keys: Array<string | number>): void {
		for (const key of keys) this.#entries.delete(key);
	}

	clear(): void {
		this.#entries.clear();
	}

	async estimateStoragePressure(): Promise<CacheStorageEstimate> {
		const estimate = await this.options.getStorageEstimate();
		return {
			usageBytes: Math.max(0, estimate.usageBytes),
			quotaBytes: Math.max(1, estimate.quotaBytes),
			utilizationRatio: estimate.usageBytes / Math.max(1, estimate.quotaBytes),
		};
	}

	async evictIfNeeded(
		viewport: CacheViewport,
	): Promise<{ evictedKeys: Array<string | number>; estimate: CacheStorageEstimate }> {
		const estimate = await this.estimateStoragePressure();
		if (estimate.utilizationRatio < this.evictionThreshold) {
			return { evictedKeys: [], estimate };
		}

		const candidates = Array.from(this.#entries.values())
			.filter((entry) => !this.#isEntryProtectedByViewport(entry, viewport))
			.sort((a, b) => this.#scoreEntry(b, viewport) - this.#scoreEntry(a, viewport));

		const evictedKeys: Array<string | number> = [];
		let currentEstimate = estimate;
		for (const candidate of candidates) {
			if (currentEstimate.utilizationRatio <= this.evictionTarget) break;
			evictedKeys.push(candidate.key);
			this.#entries.delete(candidate.key);
			currentEstimate = {
				...currentEstimate,
				usageBytes: Math.max(0, currentEstimate.usageBytes - candidate.estimatedSizeBytes),
				utilizationRatio:
					Math.max(0, currentEstimate.usageBytes - candidate.estimatedSizeBytes) /
					currentEstimate.quotaBytes,
			};
		}

		if (evictedKeys.length > 0) {
			await this.options.deleteRows(evictedKeys);
		}
		return { evictedKeys, estimate: currentEstimate };
	}

	#scoreEntry(entry: CacheEntry, viewport: CacheViewport): number {
		const now = Date.now();
		const timeSinceAccessMs = Math.max(0, now - entry.lastAccessedAt);
		const distance = this.#distanceFromViewport(entry, viewport);
		// Weighted score: heavily prefer evicting far-away rows that have not been used recently.
		return timeSinceAccessMs * 0.001 + distance * 1000;
	}

	#distanceFromViewport(entry: CacheEntry, viewport: CacheViewport): number {
		const value = entry.sortPositions.get(viewport.sortColumn);
		if (value === undefined || value === null) return 1;
		const lowerCompare = this.#compareValues(value, viewport.fromValue);
		const upperCompare = this.#compareValues(value, viewport.toValue);
		if (lowerCompare >= 0 && upperCompare <= 0) return 0;
		const lowerDistance = Math.abs(lowerCompare);
		const upperDistance = Math.abs(upperCompare);
		return Math.min(lowerDistance, upperDistance);
	}

	#isEntryProtectedByViewport(entry: CacheEntry, viewport: CacheViewport): boolean {
		return this.#distanceFromViewport(entry, viewport) === 0;
	}

	#compareValues(left: unknown, right: unknown): number {
		const normalizedLeft = left instanceof Date ? left.getTime() : left;
		const normalizedRight = right instanceof Date ? right.getTime() : right;
		if (typeof normalizedLeft === "number" && typeof normalizedRight === "number") {
			if (normalizedLeft === normalizedRight) return 0;
			return normalizedLeft < normalizedRight ? -1 : 1;
		}
		const leftStr = String(normalizedLeft);
		const rightStr = String(normalizedRight);
		return leftStr.localeCompare(rightStr);
	}
}
