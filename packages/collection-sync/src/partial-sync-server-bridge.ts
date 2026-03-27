import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type {
	SyncClientMessage,
	SyncRangeSort,
	SyncServerMessage,
} from "./sync-protocol";

export type DeliveredRange = {
	sortColumn: string;
	sortDirection: "asc" | "desc";
	fromValue: unknown;
	toValue: unknown;
};

export type ClientQueryState<TItem = unknown> = {
	clientId: string;
	deliveredRanges: DeliveredRange[];
	pendingPatches: SyncMessage<TItem>[];
	streaming: boolean;
};

export interface PartialSyncServerBridgeStore<TItem> {
	queryRange: (options: {
		sort: SyncRangeSort;
		limit: number;
		afterCursor: unknown | null;
		chunkSize: number;
	}) => AsyncIterable<TItem[]>;
	queryByOffset: (options: {
		sort: SyncRangeSort;
		limit: number;
		offset: number;
		chunkSize: number;
	}) => AsyncIterable<TItem[]>;
	getTotalCount: () => Promise<number>;
	getSortValue: (row: TItem, column: string) => unknown;
}

export interface PartialSyncServerBridgeOptions<TItem> {
	store: PartialSyncServerBridgeStore<TItem>;
	sendToClient: (clientId: string, message: SyncServerMessage<TItem>) => void;
	queryChunkSize?: number;
}

export class PartialSyncServerBridge<TItem> {
	#clientStates = new Map<string, ClientQueryState<TItem>>();

	constructor(private readonly options: PartialSyncServerBridgeOptions<TItem>) {}

	async handleClientMessage(message: SyncClientMessage): Promise<void> {
		switch (message.type) {
			case "ping":
				this.options.sendToClient(message.clientId, {
					type: "pong",
					timestamp: message.timestamp,
				});
				return;
			case "queryRange":
				await this.#handleQueryRange(message);
				return;
			case "queryByOffset":
				await this.#handleQueryByOffset(message);
				return;
			case "syncHello":
			case "mutateBatch":
				// Partial sync query bridge is read-focused. Full mutation flow remains in SyncServerBridge.
				return;
			default:
				exhaustiveGuard(message);
		}
	}

	async pushServerChanges(changes: SyncMessage<TItem>[]): Promise<void> {
		for (const state of this.#clientStates.values()) {
			for (const change of changes) {
				if (!this.#isChangeInDeliveredRanges(state.deliveredRanges, change)) continue;
				if (state.streaming) {
					state.pendingPatches.push(change);
					continue;
				}
				this.options.sendToClient(state.clientId, {
					type: "rangePatch",
					change,
				});
			}
		}
	}

	getClientState(clientId: string): ClientQueryState<TItem> | undefined {
		return this.#clientStates.get(clientId);
	}

	async #handleQueryRange(
		message: Extract<SyncClientMessage, { type: "queryRange" }>,
	): Promise<void> {
		const state = this.#getOrCreateClientState(message.clientId);
		state.streaming = true;
		const totalCount = await this.options.store.getTotalCount();
		const chunkSize = Math.max(1, this.options.queryChunkSize ?? 200);
		const iterable = this.options.store.queryRange({
			sort: message.sort,
			limit: message.limit,
			afterCursor: message.afterCursor,
			chunkSize,
		});
		let chunkIndex = 0;
		let totalDelivered = 0;
		let emittedAny = false;
		for await (const rows of iterable) {
			emittedAny = true;
			totalDelivered += rows.length;
			const reachedLimit = totalDelivered >= message.limit;
			const likelyFinalChunk = rows.length < chunkSize || reachedLimit;
			const isFinalChunk = likelyFinalChunk;
			const lastRow = rows[rows.length - 1];
			const lastCursor =
				lastRow === undefined
					? message.afterCursor
					: this.options.store.getSortValue(lastRow, message.sort.column);
			// Pagination: more pages may exist if this request returned a full page and
			// the table still has rows beyond what we returned (not `!isFinalChunk`, which
			// only meant "more chunks in this stream" and wrongly set hasMore=false on the
			// last chunk of a single-page response).
			const hasMoreForClient = isFinalChunk
				? totalDelivered === message.limit && totalDelivered < totalCount
				: true;
			this.options.sendToClient(message.clientId, {
				type: "queryRangeChunk",
				requestId: message.requestId,
				rows,
				totalCount,
				lastCursor,
				hasMore: hasMoreForClient,
				chunkIndex,
				done: isFinalChunk,
			});
			this.#trackDeliveredRange(state, message.sort, message.afterCursor, rows);
			chunkIndex += 1;
			if (isFinalChunk) {
				break;
			}
		}

		if (!emittedAny) {
			this.options.sendToClient(message.clientId, {
				type: "queryRangeChunk",
				requestId: message.requestId,
				rows: [],
				totalCount,
				lastCursor: message.afterCursor,
				hasMore: false,
				chunkIndex,
				done: true,
			});
		}

		state.streaming = false;
		this.#flushPendingPatches(state);
	}

	async #handleQueryByOffset(
		message: Extract<SyncClientMessage, { type: "queryByOffset" }>,
	): Promise<void> {
		const state = this.#getOrCreateClientState(message.clientId);
		state.streaming = true;
		const totalCount = await this.options.store.getTotalCount();
		const chunkSize = Math.max(1, this.options.queryChunkSize ?? 200);
		const iterable = this.options.store.queryByOffset({
			sort: message.sort,
			limit: message.limit,
			offset: message.offset,
			chunkSize,
		});
		let chunkIndex = 0;
		let totalDelivered = 0;
		let emittedAny = false;
		for await (const rows of iterable) {
			emittedAny = true;
			totalDelivered += rows.length;
			const reachedLimit = totalDelivered >= message.limit;
			const likelyFinalChunk = rows.length < chunkSize || reachedLimit;
			const isFinalChunk = likelyFinalChunk;
			const lastRow = rows[rows.length - 1];
			const lastCursor =
				lastRow === undefined
					? null
					: this.options.store.getSortValue(lastRow, message.sort.column);
			const hasMoreForClient = isFinalChunk
				? totalDelivered === message.limit && message.offset + totalDelivered < totalCount
				: true;
			this.options.sendToClient(message.clientId, {
				type: "queryRangeChunk",
				requestId: message.requestId,
				rows,
				totalCount,
				lastCursor,
				hasMore: hasMoreForClient,
				chunkIndex,
				done: isFinalChunk,
			});
			this.#trackDeliveredRange(state, message.sort, null, rows);
			chunkIndex += 1;
			if (isFinalChunk) {
				break;
			}
		}

		if (!emittedAny) {
			this.options.sendToClient(message.clientId, {
				type: "queryRangeChunk",
				requestId: message.requestId,
				rows: [],
				totalCount,
				lastCursor: null,
				hasMore: false,
				chunkIndex,
				done: true,
			});
		}

		state.streaming = false;
		this.#flushPendingPatches(state);
	}

	#getOrCreateClientState(clientId: string): ClientQueryState<TItem> {
		let state = this.#clientStates.get(clientId);
		if (!state) {
			state = {
				clientId,
				deliveredRanges: [],
				pendingPatches: [],
				streaming: false,
			};
			this.#clientStates.set(clientId, state);
		}
		return state;
	}

	#trackDeliveredRange(
		state: ClientQueryState<TItem>,
		sort: SyncRangeSort,
		afterCursor: unknown | null,
		rows: TItem[],
	): void {
		if (rows.length === 0) return;
		const firstValue =
			afterCursor ??
			this.options.store.getSortValue(rows[0] as TItem, sort.column);
		const lastValue = this.options.store.getSortValue(
			rows[rows.length - 1] as TItem,
			sort.column,
		);
		const range: DeliveredRange = {
			sortColumn: sort.column,
			sortDirection: sort.direction,
			fromValue: firstValue,
			toValue: lastValue,
		};
		state.deliveredRanges.push(range);
	}

	#flushPendingPatches(state: ClientQueryState<TItem>): void {
		if (state.pendingPatches.length === 0) return;
		for (const change of state.pendingPatches) {
			this.options.sendToClient(state.clientId, {
				type: "rangePatch",
				change,
			});
		}
		state.pendingPatches.length = 0;
	}

	#isChangeInDeliveredRanges(
		ranges: DeliveredRange[],
		change: SyncMessage<TItem>,
	): boolean {
		if (ranges.length === 0) return false;
		if (change.type === "truncate") return true;
		if (change.type === "delete") return true;
		if (change.type === "insert" || change.type === "update") {
			return ranges.some((range) => {
				const sortValue = this.options.store.getSortValue(
					change.value,
					range.sortColumn,
				);
				return this.#isWithinRange(sortValue, range);
			});
		}
		exhaustiveGuard(change);
	}

	#isWithinRange(value: unknown, range: DeliveredRange): boolean {
		if (value === undefined || value === null) return false;
		const compareFrom = this.#compareValues(value, range.fromValue);
		const compareTo = this.#compareValues(value, range.toValue);
		if (range.sortDirection === "asc") {
			return compareFrom >= 0 && compareTo <= 0;
		}
		return compareFrom <= 0 && compareTo >= 0;
	}

	#compareValues(left: unknown, right: unknown): number {
		const leftValue = left instanceof Date ? left.getTime() : left;
		const rightValue = right instanceof Date ? right.getTime() : right;
		if (typeof leftValue === "number" && typeof rightValue === "number") {
			return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
		}
		const leftString = String(leftValue);
		const rightString = String(rightValue);
		return leftString.localeCompare(rightString);
	}
}
