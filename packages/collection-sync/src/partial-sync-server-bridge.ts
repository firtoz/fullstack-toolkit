import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import {
	classifyPartialSyncRangePatch,
	filterSyncMessagesForPredicateRange,
	type DeliveredRange,
	type PartialSyncPatchResult,
} from "./partial-sync-interest";
import { defaultPredicateColumnValue } from "./partial-sync-predicate-match";
import type { PartialSyncRowId } from "./partial-sync-row-key";
import { partialSyncRowKey } from "./partial-sync-row-key";

function deliveredRowIdKey(id: PartialSyncRowId): string {
	return String(partialSyncRowKey(id));
}
import type {
	RangeCondition,
	SyncClientMessage,
	SyncRange,
	SyncRangeSort,
	SyncServerMessage,
	SyncServerMessageBody,
} from "./sync-protocol";
import { DEFAULT_SYNC_COLLECTION_ID } from "./sync-protocol";
import type { PartialSyncRowShape } from "./partial-sync-row-key";

export type { DeliveredRange } from "./partial-sync-interest";

export type ClientQueryState<
	TItem extends PartialSyncRowShape = { id: string; updatedAt: null },
> = {
	clientId: string;
	deliveredRanges: DeliveredRange[];
	/** Each entry is one predicate query's `conditions` (AND); OR across entries. */
	predicateGroups: RangeCondition[][];
	/** Row ids delivered to this client in the current interest session (for scoped deletes). */
	deliveredRowIds: Set<string>;
	pendingPatches: PartialSyncPatchResult<TItem>[];
	streaming: boolean;
};

export interface PartialSyncServerBridgeStore<
	TItem extends PartialSyncRowShape,
> {
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

	/** Predicate-based range (optional). */
	queryByPredicate?: (options: {
		conditions: RangeCondition[];
		sort?: SyncRangeSort;
		limit?: number;
		chunkSize: number;
	}) => AsyncIterable<TItem[]>;

	getPredicateCount?: (conditions: RangeCondition[]) => Promise<number>;

	/**
	 * Changes since `sinceVersion` within `range`. `null` if changelog cannot answer
	 * (caller should full-fetch).
	 */
	changesSince?: (options: {
		range: SyncRange;
		sinceVersion: number;
		chunkSize: number;
	}) => Promise<{ changes: SyncMessage<TItem>[]; totalCount: number } | null>;
}

export type PartialSyncPushServerChangesOptions = {
	/**
	 * Do not emit `rangePatch` to this client (e.g. the mutation author already applied the change
	 * locally and receives `ack` with the same payload).
	 */
	excludeClientId?: string;
};

export interface PartialSyncServerBridgeOptions<
	TItem extends PartialSyncRowShape,
> {
	store: PartialSyncServerBridgeStore<TItem>;
	sendToClient: (clientId: string, message: SyncServerMessage<TItem>) => void;
	queryChunkSize?: number;
	/** Multiplex key for sync messages. Default {@link DEFAULT_SYNC_COLLECTION_ID}. */
	collectionId?: string;
	/**
	 * Narrow client-requested predicate conditions (e.g. fog of war). Applied before querying and
	 * before interest tracking for predicate `rangeQuery`.
	 */
	resolveClientVisibility?: (
		clientId: string,
		requestedConditions: RangeCondition[],
	) => RangeCondition[] | Promise<RangeCondition[]>;
}

export class PartialSyncServerBridge<TItem extends PartialSyncRowShape> {
	#clientStates = new Map<string, ClientQueryState<TItem>>();
	readonly #cid: string;

	constructor(private readonly options: PartialSyncServerBridgeOptions<TItem>) {
		this.#cid = options.collectionId ?? DEFAULT_SYNC_COLLECTION_ID;
	}

	get collectionId(): string {
		return this.#cid;
	}

	#emit(clientId: string, body: SyncServerMessageBody<TItem>): void {
		this.options.sendToClient(clientId, {
			...body,
			collectionId: this.#cid,
		} as SyncServerMessage<TItem>);
	}

	async handleClientMessage(message: SyncClientMessage): Promise<void> {
		const mid = message.collectionId ?? DEFAULT_SYNC_COLLECTION_ID;
		if (mid !== this.#cid) return;
		switch (message.type) {
			case "ping":
				this.#emit(message.clientId, {
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
			case "rangeQuery":
				await this.#handleRangeQuery(message);
				return;
			case "syncHello":
			case "mutateBatch":
				// Partial sync query bridge is read-focused. Full mutation flow remains in SyncServerBridge.
				return;
			default:
				exhaustiveGuard(message);
		}
	}

	async pushServerChanges(
		changes: SyncMessage<TItem>[],
		options?: PartialSyncPushServerChangesOptions,
	): Promise<void> {
		const exclude = options?.excludeClientId;
		for (const state of this.#clientStates.values()) {
			if (exclude !== undefined && state.clientId === exclude) continue;
			for (const change of changes) {
				const patch = classifyPartialSyncRangePatch(
					state.deliveredRanges,
					state.predicateGroups,
					change,
					(row, column) => this.options.store.getSortValue(row, column),
					(row, column) => defaultPredicateColumnValue(row, column),
					{ deliveredRowIds: state.deliveredRowIds },
				);
				if (patch === null) continue;
				if (state.streaming) {
					state.pendingPatches.push(patch);
					continue;
				}
				this.#emit(state.clientId, {
					type: "rangePatch",
					change: patch.change,
					...(patch.viewTransition !== undefined
						? { viewTransition: patch.viewTransition }
						: {}),
				});
				this.#applyPatchToDeliveredRowIds(state, patch);
			}
		}
	}

	/**
	 * Drop partial-sync interest for a disconnected client (prevents unbounded `#clientStates`
	 * growth and stale subscriptions).
	 */
	removeClient(clientId: string): void {
		this.#clientStates.delete(clientId);
	}

	/**
	 * Replace predicate interest for a client (server-authoritative visibility). Clears sort-range
	 * tracking; the next `rangeQuery` should re-establish delivered ranges from fresh chunks.
	 */
	setClientVisibility(clientId: string, conditions: RangeCondition[]): void {
		const state = this.#getOrCreateClientState(clientId);
		state.predicateGroups = [[...conditions]];
		state.deliveredRanges.length = 0;
		state.deliveredRowIds.clear();
	}

	getClientState(clientId: string): ClientQueryState<TItem> | undefined {
		return this.#clientStates.get(clientId);
	}

	#resetClientInterest(state: ClientQueryState<TItem>): void {
		state.deliveredRanges.length = 0;
		state.predicateGroups.length = 0;
		state.pendingPatches.length = 0;
		state.deliveredRowIds.clear();
	}

	#trackDeliveredRowIdsFromRows(
		state: ClientQueryState<TItem>,
		rows: TItem[],
	): void {
		for (const row of rows) {
			state.deliveredRowIds.add(deliveredRowIdKey(row.id));
		}
	}

	#trackDeliveredRowIdsFromMessages(
		state: ClientQueryState<TItem>,
		messages: SyncMessage<TItem>[],
	): void {
		for (const c of messages) {
			if (c.type === "insert" || c.type === "update") {
				state.deliveredRowIds.add(deliveredRowIdKey(c.value.id));
			}
			if (c.type === "delete") {
				state.deliveredRowIds.delete(deliveredRowIdKey(c.key));
			}
			if (c.type === "truncate") {
				state.deliveredRowIds.clear();
			}
		}
	}

	#applyPatchToDeliveredRowIds(
		state: ClientQueryState<TItem>,
		patch: PartialSyncPatchResult<TItem>,
	): void {
		const ch = patch.change;
		if (ch.type === "truncate") {
			state.deliveredRowIds.clear();
			return;
		}
		if (ch.type === "delete") {
			state.deliveredRowIds.delete(deliveredRowIdKey(ch.key));
			return;
		}
		if (ch.type === "insert") {
			state.deliveredRowIds.add(deliveredRowIdKey(ch.value.id));
			return;
		}
		if (ch.type === "update") {
			const id = deliveredRowIdKey(ch.value.id);
			if (patch.viewTransition === "exitView") {
				state.deliveredRowIds.delete(id);
			} else {
				state.deliveredRowIds.add(id);
			}
		}
	}

	async #handleRangeQuery(
		message: Extract<SyncClientMessage, { type: "rangeQuery" }>,
	): Promise<void> {
		const { clientId, requestId, fingerprint } = message;
		let range: SyncRange = message.range;
		const state = this.#getOrCreateClientState(clientId);
		/** Predicate viewport queries replace interest; index fingerprint refresh must keep sort ranges. */
		if (range.kind === "predicate") {
			this.#resetClientInterest(state);
		} else {
			state.predicateGroups.length = 0;
			state.pendingPatches.length = 0;
		}

		if (range.kind === "predicate") {
			const resolved =
				this.options.resolveClientVisibility !== undefined
					? await this.options.resolveClientVisibility(
							clientId,
							range.conditions,
						)
					: range.conditions;
			range = { ...range, conditions: resolved };
			state.predicateGroups.push([...resolved]);
		}

		const rangeLimit =
			range.kind === "index" ? range.limit : (range.limit ?? 200);

		if (fingerprint !== undefined && this.options.store.changesSince) {
			const delta = await this.options.store.changesSince({
				range,
				sinceVersion: fingerprint.version,
				chunkSize: Math.max(1, this.options.queryChunkSize ?? 200),
			});
			if (delta !== null) {
				if (delta.changes.length === 0) {
					this.#emit(clientId, {
						type: "rangeUpToDate",
						requestId,
						totalCount: delta.totalCount,
					});
					this.#mergeDeliveredRangesFromChanges(state, range, delta.changes);
					return;
				}
				const maxDelta = Math.max(1, Math.ceil(rangeLimit * 0.5));
				if (delta.changes.length <= maxDelta) {
					const filteredDelta =
						range.kind === "predicate"
							? filterSyncMessagesForPredicateRange(
									range.conditions,
									delta.changes,
									(row, column) => this.options.store.getSortValue(row, column),
									defaultPredicateColumnValue,
								)
							: delta.changes;
					this.#emit(clientId, {
						type: "rangeDelta",
						requestId,
						totalCount: delta.totalCount,
						changes: filteredDelta,
					});
					this.#mergeDeliveredRangesFromChanges(state, range, filteredDelta);
					this.#trackDeliveredRowIdsFromMessages(state, filteredDelta);
					return;
				}
			}
		}

		if (range.kind === "index" && range.mode === "cursor") {
			await this.#handleQueryRange({
				type: "queryRange",
				collectionId: this.#cid,
				clientId,
				requestId,
				sort: range.sort,
				limit: range.limit,
				afterCursor: range.afterCursor,
			});
			return;
		}
		if (range.kind === "index" && range.mode === "offset") {
			await this.#handleQueryByOffset({
				type: "queryByOffset",
				collectionId: this.#cid,
				clientId,
				requestId,
				sort: range.sort,
				limit: range.limit,
				offset: range.offset,
			});
			return;
		}
		if (range.kind === "predicate") {
			await this.#handleQueryPredicate(message, range);
			return;
		}
		exhaustiveGuard(range);
	}

	async #handleQueryPredicate(
		message: Extract<SyncClientMessage, { type: "rangeQuery" }>,
		range: Extract<SyncRange, { kind: "predicate" }>,
	): Promise<void> {
		const queryByPredicate = this.options.store.queryByPredicate;
		if (!queryByPredicate) {
			const totalCount = await this.options.store.getTotalCount();
			this.#emit(message.clientId, {
				type: "queryRangeChunk",
				requestId: message.requestId,
				rows: [],
				totalCount,
				lastCursor: null,
				hasMore: false,
				chunkIndex: 0,
				done: true,
			});
			return;
		}

		const state = this.#getOrCreateClientState(message.clientId);
		state.streaming = true;
		const chunkSize = Math.max(1, this.options.queryChunkSize ?? 200);
		const limit = range.limit ?? chunkSize;
		const totalCount = this.options.store.getPredicateCount
			? await this.options.store.getPredicateCount(range.conditions)
			: await this.options.store.getTotalCount();

		const iterable = queryByPredicate({
			conditions: range.conditions,
			sort: range.sort,
			limit,
			chunkSize,
		});

		let chunkIndex = 0;
		let totalDelivered = 0;
		let emittedAny = false;
		const sortForTrack = range.sort;
		for await (const rows of iterable) {
			emittedAny = true;
			totalDelivered += rows.length;
			const reachedLimit = totalDelivered >= limit;
			const likelyFinalChunk = rows.length < chunkSize || reachedLimit;
			const isFinalChunk = likelyFinalChunk;
			const lastRow = rows[rows.length - 1];
			const lastCursor =
				lastRow === undefined || sortForTrack === undefined
					? null
					: this.options.store.getSortValue(lastRow, sortForTrack.column);
			const hasMoreForClient = isFinalChunk
				? totalDelivered === limit && totalDelivered < totalCount
				: true;
			this.#emit(message.clientId, {
				type: "queryRangeChunk",
				requestId: message.requestId,
				rows,
				totalCount,
				lastCursor,
				hasMore: hasMoreForClient,
				chunkIndex,
				done: isFinalChunk,
			});
			if (sortForTrack !== undefined) {
				this.#trackDeliveredRange(state, sortForTrack, null, rows);
			}
			this.#trackDeliveredRowIdsFromRows(state, rows as TItem[]);
			chunkIndex += 1;
			if (isFinalChunk) break;
		}

		if (!emittedAny) {
			this.#emit(message.clientId, {
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

	#mergeDeliveredRangesFromChanges(
		state: ClientQueryState<TItem>,
		range: SyncRange,
		changes: SyncMessage<TItem>[],
	): void {
		const sort =
			range.kind === "index"
				? range.sort
				: range.kind === "predicate"
					? range.sort
					: undefined;
		if (sort === undefined) return;
		const rows: TItem[] = [];
		for (const change of changes) {
			if (change.type === "insert" || change.type === "update") {
				rows.push(change.value);
			}
		}
		if (rows.length === 0) return;
		this.#trackDeliveredRange(state, sort, null, rows);
		this.#trackDeliveredRowIdsFromRows(state, rows);
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
			this.#emit(message.clientId, {
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
			this.#trackDeliveredRowIdsFromRows(state, rows as TItem[]);
			chunkIndex += 1;
			if (isFinalChunk) {
				break;
			}
		}

		if (!emittedAny) {
			this.#emit(message.clientId, {
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
				? totalDelivered === message.limit &&
					message.offset + totalDelivered < totalCount
				: true;
			this.#emit(message.clientId, {
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
			this.#trackDeliveredRowIdsFromRows(state, rows as TItem[]);
			chunkIndex += 1;
			if (isFinalChunk) {
				break;
			}
		}

		if (!emittedAny) {
			this.#emit(message.clientId, {
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
				predicateGroups: [],
				deliveredRowIds: new Set(),
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
		for (const patch of state.pendingPatches) {
			this.#emit(state.clientId, {
				type: "rangePatch",
				change: patch.change,
				...(patch.viewTransition !== undefined
					? { viewTransition: patch.viewTransition }
					: {}),
			});
			this.#applyPatchToDeliveredRowIds(state, patch);
		}
		state.pendingPatches.length = 0;
	}
}
