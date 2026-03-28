import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type {
	RangeFingerprint,
	SyncClientMessage,
	SyncRange,
	SyncRangeSort,
	SyncServerMessage,
} from "./sync-protocol";
import { createClientMutationId } from "./sync-protocol";

type CollectionWithReceiveSync<TItem> = {
	utils: {
		receiveSync: (messages: SyncMessage<TItem>[]) => Promise<void>;
	};
};

type SendFn = (msg: SyncClientMessage) => void;

export type PartialSyncState =
	| { status: "offline" }
	| { status: "connecting" }
	| { status: "connected" }
	| { status: "fetching"; requestId: string; chunksReceived: number }
	| {
			status: "partial";
			cachedCount: number;
			totalCount: number;
			cacheUtilization: number;
	  }
	| {
			status: "realtime";
			cachedCount: number;
			totalCount: number;
			cacheUtilization: number;
	  }
	| { status: "evicting"; cachedCount: number; evictingCount: number }
	| { status: "disconnected"; cachedCount: number }
	| { status: "error"; message: string };

export type PartialSyncRangeResult<TItem> = {
	rows: TItem[];
	totalCount: number;
	lastCursor: unknown | null;
	hasMore: boolean;
	/** Server applied a small delta; caller may need to refetch the window without fingerprint. */
	invalidateWindow?: boolean;
	/** Server confirmed fingerprint; no new rows on the wire. */
	upToDate?: boolean;
};

export interface PartialSyncClientBridgeOptions<
	TItem extends { id: string | number },
> {
	clientId: string;
	collection: CollectionWithReceiveSync<TItem>;
	send: SendFn;
	onStateChange?: (state: PartialSyncState) => void;
	beforeApplyRows?: (rows: TItem[]) => Promise<void>;
}

type InFlightRequest<TItem> = {
	requestId: string;
	rows: TItem[];
	totalCount: number;
	lastCursor: unknown | null;
	hasMore: boolean;
	chunksReceived: number;
	resolve: (result: PartialSyncRangeResult<TItem>) => void;
	reject: (error: unknown) => void;
};

export class PartialSyncClientBridge<TItem extends { id: string | number }> {
	readonly clientId: string;
	#connected = false;
	#state: PartialSyncState = { status: "offline" };
	#inFlightRequests = new Map<string, InFlightRequest<TItem>>();
	#cachedIds = new Set<string | number>();
	#cacheUtilization = 0;
	#totalCount = 0;
	#sendFn: SendFn;

	constructor(private readonly options: PartialSyncClientBridgeOptions<TItem>) {
		this.clientId = options.clientId;
		this.#sendFn = options.send;
	}

	get state(): PartialSyncState {
		return this.#state;
	}

	get cachedCount(): number {
		return this.#cachedIds.size;
	}

	setConnecting(): void {
		this.#setState({ status: "connecting" });
	}

	setConnected(connected: boolean): void {
		this.#connected = connected;
		if (!connected) {
			this.#setState({ status: "disconnected", cachedCount: this.cachedCount });
			return;
		}
		if (this.cachedCount > 0) {
			this.#setState({
				status: "realtime",
				cachedCount: this.cachedCount,
				totalCount: this.#totalCount,
				cacheUtilization: this.#cacheUtilization,
			});
			return;
		}
		this.#setState({ status: "connected" });
	}

	setOffline(): void {
		this.#connected = false;
		this.#setState({ status: "offline" });
	}

	setSend(send: SendFn): void {
		this.#sendFn = send;
	}

	setError(message: string): void {
		this.#setState({ status: "error", message });
	}

	setCacheUtilization(utilization: number): void {
		this.#cacheUtilization = Math.max(0, utilization);
		if (this.#state.status === "partial" || this.#state.status === "realtime") {
			this.#setState({
				...this.#state,
				cacheUtilization: this.#cacheUtilization,
			});
		}
	}

	setEvicting(evictingCount: number): void {
		this.#setState({
			status: "evicting",
			cachedCount: this.cachedCount,
			evictingCount,
		});
	}

	clearEvictingState(): void {
		this.#setState({
			status: this.#connected ? "realtime" : "partial",
			cachedCount: this.cachedCount,
			totalCount: this.#totalCount,
			cacheUtilization: this.#cacheUtilization,
		});
	}

	/** Drop in-flight `queryRange` / `queryByOffset` requests (e.g. user seek / sort reset). */
	abortRangeRequests(): void {
		for (const inflight of this.#inFlightRequests.values()) {
			inflight.reject(
				Object.assign(new Error("Range request aborted"), {
					name: "AbortError",
				}),
			);
		}
		this.#inFlightRequests.clear();
	}

	/**
	 * Clear tracked row ids (e.g. after a local `truncate()` on the collection). Local truncate
	 * does not flow through `receiveSync`, so the bridge must be reset to match.
	 */
	clearTrackedRowIds(): void {
		this.#cachedIds.clear();
		const s = this.#state;
		if (s.status === "partial" || s.status === "realtime") {
			this.#setState({ ...s, cachedCount: 0 });
		} else if (s.status === "disconnected") {
			this.#setState({ status: "disconnected", cachedCount: 0 });
		} else if (s.status === "evicting") {
			this.#setState({ ...s, cachedCount: 0 });
		}
	}

	requestRange(
		sort: SyncRangeSort,
		limit: number,
		afterCursor: unknown | null,
	): Promise<PartialSyncRangeResult<TItem>> {
		const requestId = createClientMutationId("qr");
		this.#setState({
			status: "fetching",
			requestId,
			chunksReceived: 0,
		});

		return new Promise<PartialSyncRangeResult<TItem>>((resolve, reject) => {
			this.#inFlightRequests.set(requestId, {
				requestId,
				rows: [],
				totalCount: 0,
				lastCursor: afterCursor,
				hasMore: false,
				chunksReceived: 0,
				resolve,
				reject,
			});
			this.#sendFn({
				type: "queryRange",
				clientId: this.clientId,
				requestId,
				sort,
				limit,
				afterCursor,
			});
		});
	}

	requestByOffset(
		sort: SyncRangeSort,
		limit: number,
		offset: number,
	): Promise<PartialSyncRangeResult<TItem>> {
		const requestId = createClientMutationId("qo");
		this.#setState({
			status: "fetching",
			requestId,
			chunksReceived: 0,
		});

		return new Promise<PartialSyncRangeResult<TItem>>((resolve, reject) => {
			this.#inFlightRequests.set(requestId, {
				requestId,
				rows: [],
				totalCount: 0,
				lastCursor: null,
				hasMore: false,
				chunksReceived: 0,
				resolve,
				reject,
			});
			this.#sendFn({
				type: "queryByOffset",
				clientId: this.clientId,
				requestId,
				sort,
				limit,
				offset,
			});
		});
	}

	requestRangeQuery(
		range: SyncRange,
		fingerprint?: RangeFingerprint,
	): Promise<PartialSyncRangeResult<TItem>> {
		const requestId = createClientMutationId("rq");
		this.#setState({
			status: "fetching",
			requestId,
			chunksReceived: 0,
		});

		return new Promise<PartialSyncRangeResult<TItem>>((resolve, reject) => {
			this.#inFlightRequests.set(requestId, {
				requestId,
				rows: [],
				totalCount: 0,
				lastCursor: null,
				hasMore: false,
				chunksReceived: 0,
				resolve,
				reject,
			});
			this.#sendFn({
				type: "rangeQuery",
				clientId: this.clientId,
				requestId,
				range,
				...(fingerprint !== undefined ? { fingerprint } : {}),
			});
		});
	}

	async handleServerMessage(message: SyncServerMessage<TItem>): Promise<void> {
		switch (message.type) {
			case "queryRangeChunk":
				await this.#handleQueryRangeChunk(message);
				return;
			case "rangeUpToDate":
				this.#handleRangeUpToDate(message);
				return;
			case "rangeDelta":
				await this.#handleRangeDelta(message);
				return;
			case "rangePatch":
				await this.#applyAndTrack([message.change]);
				return;
			case "syncBatch":
				await this.#applyAndTrack(message.changes as SyncMessage<TItem>[]);
				return;
			case "ack":
				await this.#applyAndTrack(message.changes as SyncMessage<TItem>[]);
				return;
			case "syncBackfill":
				await this.#applyAndTrack(message.changes as SyncMessage<TItem>[]);
				return;
			case "reject":
				this.setError(message.reason);
				return;
			case "pong":
				return;
			default:
				exhaustiveGuard(message);
		}
	}

	async #handleQueryRangeChunk(
		message: Extract<SyncServerMessage<TItem>, { type: "queryRangeChunk" }>,
	): Promise<void> {
		const inFlight = this.#inFlightRequests.get(message.requestId);
		if (!inFlight) return;
		inFlight.chunksReceived += 1;
		inFlight.totalCount = message.totalCount;
		inFlight.lastCursor = message.lastCursor;
		inFlight.hasMore = message.hasMore;
		this.#totalCount = message.totalCount;
		this.#setState({
			status: "fetching",
			requestId: message.requestId,
			chunksReceived: inFlight.chunksReceived,
		});

		if (message.rows.length > 0) {
			await this.options.beforeApplyRows?.(message.rows);
			const rowsToInsert = message.rows.filter(
				(row) => !this.#cachedIds.has(row.id),
			);
			if (rowsToInsert.length > 0) {
				const changes = rowsToInsert.map(
					(row) =>
						({
							type: "insert",
							value: row,
						}) as SyncMessage<TItem>,
				);
				await this.#applyAndTrack(changes);
			}
			inFlight.rows.push(...message.rows);
		}

		if (!message.done) return;
		this.#inFlightRequests.delete(message.requestId);
		const result: PartialSyncRangeResult<TItem> = {
			rows: inFlight.rows,
			totalCount: inFlight.totalCount,
			lastCursor: inFlight.lastCursor,
			hasMore: inFlight.hasMore,
		};
		inFlight.resolve(result);
		this.#setState({
			status: this.#connected ? "realtime" : "partial",
			cachedCount: this.cachedCount,
			totalCount: this.#totalCount,
			cacheUtilization: this.#cacheUtilization,
		});
	}

	#handleRangeUpToDate(
		message: Extract<SyncServerMessage<TItem>, { type: "rangeUpToDate" }>,
	): void {
		const inFlight = this.#inFlightRequests.get(message.requestId);
		if (!inFlight) return;
		this.#inFlightRequests.delete(message.requestId);
		this.#totalCount = message.totalCount;
		inFlight.resolve({
			rows: [],
			totalCount: message.totalCount,
			lastCursor: null,
			hasMore: false,
			upToDate: true,
		});
		this.#setState({
			status: this.#connected ? "realtime" : "partial",
			cachedCount: this.cachedCount,
			totalCount: this.#totalCount,
			cacheUtilization: this.#cacheUtilization,
		});
	}

	async #handleRangeDelta(
		message: Extract<SyncServerMessage<TItem>, { type: "rangeDelta" }>,
	): Promise<void> {
		const inFlight = this.#inFlightRequests.get(message.requestId);
		if (!inFlight) return;
		await this.#applyAndTrack(message.changes as SyncMessage<TItem>[]);
		this.#inFlightRequests.delete(message.requestId);
		this.#totalCount = message.totalCount;
		inFlight.resolve({
			rows: [],
			totalCount: message.totalCount,
			lastCursor: message.lastCursor ?? null,
			hasMore: false,
			invalidateWindow: true,
		});
		this.#setState({
			status: this.#connected ? "realtime" : "partial",
			cachedCount: this.cachedCount,
			totalCount: this.#totalCount,
			cacheUtilization: this.#cacheUtilization,
		});
	}

	async #applyAndTrack(changes: SyncMessage<TItem>[]): Promise<void> {
		if (changes.length === 0) return;
		await this.options.collection.utils.receiveSync(changes);
		for (const change of changes) {
			switch (change.type) {
				case "insert":
					this.#cachedIds.add(change.value.id);
					break;
				case "update":
					this.#cachedIds.add(change.value.id);
					break;
				case "delete":
					this.#cachedIds.delete(change.key);
					break;
				case "truncate":
					this.#cachedIds.clear();
					break;
				default:
					exhaustiveGuard(change);
			}
		}
	}

	#setState(state: PartialSyncState): void {
		this.#state = state;
		this.options.onStateChange?.(state);
	}
}
