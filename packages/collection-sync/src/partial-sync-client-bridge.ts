import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import type {
	RangeFingerprint,
	SyncClientMessage,
	SyncClientMessageBody,
	SyncRange,
	SyncRangeSort,
	SyncServerMessage,
} from "./sync-protocol";
import { DEFAULT_SYNC_COLLECTION_ID } from "./sync-protocol";
import { createClientMutationId } from "./sync-protocol";
import {
	partialSyncRowKey,
	partialSyncRowVersionWatermarkMs,
	type PartialSyncRowShape,
} from "./partial-sync-row-key";
import type { PartialSyncViewTransition } from "./partial-sync-interest";

export type PartialSyncViewTransitionEvent<TItem extends PartialSyncRowShape> =
	{
		type: PartialSyncViewTransition;
		change: SyncMessage<TItem>;
	};

export type PartialSyncRangePatchAppliedEvent<
	TItem extends PartialSyncRowShape,
> = {
	change: SyncMessage<TItem>;
	viewTransition?: PartialSyncViewTransition;
};

type CollectionWithReceiveSync<TItem> = {
	utils: {
		receiveSync: (messages: SyncMessage<TItem>[]) => Promise<void>;
	};
	/**
	 * When set, server `queryRangeChunk` rows can become `update` messages when the collection
	 * already holds that id — including durable hydration (IndexedDB / SQLite reload) where rows
	 * exist before {@link PartialSyncClientBridge.seedHydratedLocalRows} runs or if it is skipped.
	 * Without this, the bridge may emit `insert` and hit duplicate-key errors from `receiveSync`.
	 */
	get?: (key: string | number) => TItem | undefined;
};

function serverRowSupersedesLocal<TItem extends PartialSyncRowShape>(
	local: TItem,
	server: TItem,
): boolean {
	const lm = partialSyncRowVersionWatermarkMs(local);
	const sm = partialSyncRowVersionWatermarkMs(server);
	if (sm > lm) return true;
	if (sm < lm) return false;
	try {
		return JSON.stringify(local) !== JSON.stringify(server);
	} catch {
		return true;
	}
}

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
	TItem extends PartialSyncRowShape,
> {
	/** Defaults to a random UUID when omitted (must match {@link SyncClientBridge} when using mutations). */
	clientId?: string;
	/** Must match the server's partial-sync {@link PartialSyncServerBridgeOptions.collectionId}. */
	collectionId?: string;
	collection: CollectionWithReceiveSync<TItem>;
	send: SendFn;
	onStateChange?: (state: PartialSyncState) => void;
	beforeApplyRows?: (rows: TItem[]) => Promise<void>;
	/** Fired when a `rangePatch` carries `viewTransition` (row crossed client interest). */
	onViewTransition?: (event: PartialSyncViewTransitionEvent<TItem>) => void;
	/** Fired after any `rangePatch` is applied (including view transitions). */
	onRangePatchApplied?: (
		event: PartialSyncRangePatchAppliedEvent<TItem>,
	) => void;
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

export class PartialSyncClientBridge<TItem extends PartialSyncRowShape> {
	readonly clientId: string;
	readonly collectionId: string;
	#connected = false;
	#state: PartialSyncState = { status: "offline" };
	#inFlightRequests = new Map<string, InFlightRequest<TItem>>();
	#cachedIds = new Set<string | number>();
	#cacheUtilization = 0;
	#totalCount = 0;
	#sendFn: SendFn;
	/** Row keys last delivered by a completed server range response (see viewport `cacheDisplayMode`). */
	#serverConfirmedKeys = new Set<string | number>();
	#serverConfirmedKeysRevision = 0;
	#confirmedRevisionListeners = new Set<() => void>();
	/**
	 * Ensures `queryRangeChunk` / `rangeDelta` handlers never overlap: concurrent
	 * {@link handleServerMessage} calls must not run `receiveSync` in parallel for range fetches.
	 */
	#rangeFetchApplySerial: Promise<void> = Promise.resolve();
	/**
	 * Plain `rangePatch` updates: merge by row key. `connectPartialSync` calls
	 * `flushPendingCoalescedInboundUpdates` after each inbound pump pass; call it yourself if you use
	 * the bridge without that helper.
	 */
	#pendingCoalescedUpdatesByKey = new Map<
		string | number,
		Extract<SyncMessage<TItem>, { type: "update" }>
	>();

	constructor(private readonly options: PartialSyncClientBridgeOptions<TItem>) {
		this.clientId = options.clientId ?? crypto.randomUUID();
		this.collectionId = options.collectionId ?? DEFAULT_SYNC_COLLECTION_ID;
		this.#sendFn = options.send;
	}

	#out(msg: SyncClientMessageBody): void {
		this.#sendFn({
			...msg,
			collectionId: this.collectionId,
		} as SyncClientMessage);
	}

	#scheduleRangeFetchApply(fn: () => Promise<void>): Promise<void> {
		const next = this.#rangeFetchApplySerial.catch(() => {}).then(fn);
		this.#rangeFetchApplySerial = next;
		return next;
	}

	get state(): PartialSyncState {
		return this.#state;
	}

	get cachedCount(): number {
		return this.#cachedIds.size;
	}

	setConnecting(): void {
		this.#pendingCoalescedUpdatesByKey.clear();
		this.#setState({ status: "connecting" });
	}

	setConnected(connected: boolean): void {
		this.#connected = connected;
		if (!connected) {
			this.#pendingCoalescedUpdatesByKey.clear();
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
		this.#pendingCoalescedUpdatesByKey.clear();
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

	#exitFetchingAfterApplyFailure(): void {
		if (this.#connected) {
			this.#setState({
				status: "realtime",
				cachedCount: this.cachedCount,
				totalCount: this.#totalCount,
				cacheUtilization: this.#cacheUtilization,
			});
		} else {
			this.#setState({
				status: "partial",
				cachedCount: this.cachedCount,
				totalCount: this.#totalCount,
				cacheUtilization: this.#cacheUtilization,
			});
		}
	}

	/**
	 * Drop in-flight `queryRange` / `queryByOffset` / `rangeQuery` requests (e.g. user seek / sort reset).
	 * {@link requestRange}, {@link requestByOffset}, and {@link requestRangeQuery} call this first so
	 * overlapping viewport debounces cannot double-apply the same rows.
	 */
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
	clearServerConfirmedKeys(): void {
		this.#serverConfirmedKeys.clear();
		this.#serverConfirmedKeysRevision += 1;
		this.#notifyConfirmedKeysRevision();
	}

	/** Keys from the latest completed `rangeQuery` / chunk response. */
	get serverConfirmedKeys(): ReadonlySet<string | number> {
		return this.#serverConfirmedKeys;
	}

	/** Bumps when {@link serverConfirmedKeys} changes; pass into predicate hooks as a dependency. */
	get serverConfirmedKeysRevision(): number {
		return this.#serverConfirmedKeysRevision;
	}

	/** Subscribe to {@link serverConfirmedKeysRevision} changes (for `useSyncExternalStore`). */
	subscribeConfirmedKeysRevision(listener: () => void): () => void {
		this.#confirmedRevisionListeners.add(listener);
		return () => {
			this.#confirmedRevisionListeners.delete(listener);
		};
	}

	#notifyConfirmedKeysRevision(): void {
		for (const listener of this.#confirmedRevisionListeners) {
			listener();
		}
	}

	clearTrackedRowIds(): void {
		this.#cachedIds.clear();
		this.#serverConfirmedKeys.clear();
		this.#serverConfirmedKeysRevision += 1;
		this.#notifyConfirmedKeysRevision();
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
		this.abortRangeRequests();
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
			this.#out({
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
		this.abortRangeRequests();
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
			this.#out({
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
		this.abortRangeRequests();
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
			this.#out({
				type: "rangeQuery",
				clientId: this.clientId,
				requestId,
				range,
				...(fingerprint !== undefined ? { fingerprint } : {}),
			});
		});
	}

	async handleServerMessage(message: SyncServerMessage<TItem>): Promise<void> {
		const mid = message.collectionId ?? DEFAULT_SYNC_COLLECTION_ID;
		if (mid !== this.collectionId) return;
		switch (message.type) {
			case "queryRangeChunk":
				await this.#scheduleRangeFetchApply(() =>
					this.#handleQueryRangeChunk(message),
				);
				return;
			case "rangeUpToDate":
				this.#handleRangeUpToDate(message);
				return;
			case "rangeDelta":
				await this.#scheduleRangeFetchApply(() =>
					this.#handleRangeDelta(message),
				);
				return;
			case "rangePatch":
				await this.#handleRangePatch(message);
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

	async #handleRangePatch(
		message: Extract<SyncServerMessage<TItem>, { type: "rangePatch" }>,
	): Promise<void> {
		const { change, viewTransition } = message;
		if (viewTransition === "exitView") {
			if (change.type === "update") {
				this.options.onViewTransition?.({ type: "exitView", change });
			}
			await this.#applyAndTrack([change]);
			this.#prunePartialInterestTrackingAfterExitView(change);
			this.options.onRangePatchApplied?.({ change, viewTransition });
			return;
		}
		if (viewTransition === "enterView") {
			if (change.type === "update") {
				this.options.onViewTransition?.({ type: "enterView", change });
				const key = partialSyncRowKey(change.value.id);
				const getRow = this.options.collection.get;
				let local = getRow !== undefined ? getRow(key) : undefined;
				if (local === undefined && getRow !== undefined) {
					if (typeof key === "number") {
						local = getRow(String(key));
					} else {
						const asNum = Number(key);
						if (!Number.isNaN(asNum)) {
							local = getRow(asNum);
						}
					}
				}
				const alreadyInCollection =
					this.#cachedIds.has(key) || local !== undefined;
				const toApply: SyncMessage<TItem>[] = alreadyInCollection
					? [change]
					: [{ type: "insert", value: change.value }];
				await this.#applyAndTrack(toApply);
				this.options.onRangePatchApplied?.({ change, viewTransition });
				return;
			}
			await this.#applyAndTrack([change]);
			this.options.onRangePatchApplied?.({ change, viewTransition });
			return;
		}
		await this.#applyAndTrack([change], change.type === "update");
		this.#mergeServerConfirmedKeysFromMessages([change]);
		this.options.onRangePatchApplied?.({ change, viewTransition });
	}

	#replaceServerConfirmedKeysFromRows(rows: readonly TItem[]): void {
		this.#serverConfirmedKeys.clear();
		for (const row of rows) {
			this.#serverConfirmedKeys.add(partialSyncRowKey(row.id));
		}
		this.#serverConfirmedKeysRevision += 1;
		this.#notifyConfirmedKeysRevision();
	}

	/** Row left the client's server-confirmed window; stop counting it as partial-sync cached. */
	#prunePartialInterestTrackingAfterExitView(change: SyncMessage<TItem>): void {
		switch (change.type) {
			case "insert":
			case "update": {
				const key = partialSyncRowKey(change.value.id);
				this.#cachedIds.delete(key);
				this.#serverConfirmedKeys.delete(key);
				break;
			}
			case "delete": {
				this.#cachedIds.delete(change.key);
				this.#serverConfirmedKeys.delete(change.key);
				break;
			}
			case "truncate":
				this.#cachedIds.clear();
				this.#serverConfirmedKeys.clear();
				break;
			default:
				exhaustiveGuard(change);
		}
		this.#serverConfirmedKeysRevision += 1;
		this.#notifyConfirmedKeysRevision();
		this.#refreshCachedCountInState();
	}

	#mergeServerConfirmedKeysFromMessages(changes: SyncMessage<TItem>[]): void {
		if (changes.length === 0) return;
		for (const change of changes) {
			switch (change.type) {
				case "insert":
				case "update":
					this.#serverConfirmedKeys.add(partialSyncRowKey(change.value.id));
					break;
				case "delete":
					this.#serverConfirmedKeys.delete(change.key);
					break;
				case "truncate":
					this.#serverConfirmedKeys.clear();
					break;
				default:
					exhaustiveGuard(change);
			}
		}
		this.#serverConfirmedKeysRevision += 1;
		this.#notifyConfirmedKeysRevision();
	}

	/** True only if this handler still owns the in-flight entry (not superseded by {@link abortRangeRequests}). */
	#isActiveRangeRequest(
		requestId: string,
		inFlight: InFlightRequest<TItem>,
	): boolean {
		return this.#inFlightRequests.get(requestId) === inFlight;
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
			if (!this.#isActiveRangeRequest(message.requestId, inFlight)) return;
			const getRow = this.options.collection.get;
			const changes: SyncMessage<TItem>[] = [];
			let cacheTouched = false;
			for (const row of message.rows) {
				const pk = partialSyncRowKey(row.id);
				const local = getRow !== undefined ? getRow(pk) : undefined;

				if (local !== undefined) {
					if (!this.#cachedIds.has(pk)) {
						this.#cachedIds.add(pk);
						cacheTouched = true;
					}
					if (serverRowSupersedesLocal(local, row)) {
						changes.push({
							type: "update",
							value: row,
							previousValue: local,
						} as SyncMessage<TItem>);
					}
					continue;
				}

				if (!this.#cachedIds.has(pk)) {
					changes.push({ type: "insert", value: row } as SyncMessage<TItem>);
				}
			}
			if (changes.length > 0) {
				try {
					await this.#applyAndTrack(changes);
				} catch (err) {
					if (!this.#isActiveRangeRequest(message.requestId, inFlight)) {
						return;
					}
					this.#inFlightRequests.delete(message.requestId);
					inFlight.reject(err as Error);
					this.#exitFetchingAfterApplyFailure();
					return;
				}
				if (!this.#isActiveRangeRequest(message.requestId, inFlight)) {
					return;
				}
			} else if (cacheTouched) {
				this.#refreshCachedCountInState();
			}
			inFlight.rows.push(...message.rows);
		}

		if (!message.done) return;
		if (!this.#isActiveRangeRequest(message.requestId, inFlight)) return;
		this.#replaceServerConfirmedKeysFromRows(inFlight.rows);
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
		const delta = message.changes as SyncMessage<TItem>[];
		await this.#applyAndTrack(delta);
		if (!this.#isActiveRangeRequest(message.requestId, inFlight)) return;
		this.#mergeServerConfirmedKeysFromMessages(delta);
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

	/**
	 * Merge rows already present in the local collection (e.g. IndexedDB eager `initialLoad`) into
	 * `#cachedIds` so {@link cachedCount} and React-driven `bridgeState` match durable storage after reload.
	 * Safe to call multiple times; ids are a set. Does not call `receiveSync`.
	 */
	seedHydratedLocalRows(rows: readonly TItem[]): void {
		if (rows.length === 0) return;
		for (const row of rows) {
			this.#cachedIds.add(partialSyncRowKey(row.id));
		}
		this.#refreshCachedCountInState();
	}

	#refreshCachedCountInState(): void {
		const s = this.#state;
		switch (s.status) {
			case "partial":
			case "realtime":
				this.#setState({ ...s, cachedCount: this.cachedCount });
				break;
			case "disconnected":
				this.#setState({
					status: "disconnected",
					cachedCount: this.cachedCount,
				});
				break;
			case "evicting":
				this.#setState({ ...s, cachedCount: this.cachedCount });
				break;
			case "connected":
				if (this.#connected && this.cachedCount > 0) {
					this.#setState({
						status: "realtime",
						cachedCount: this.cachedCount,
						totalCount: this.#totalCount,
						cacheUtilization: this.#cacheUtilization,
					});
				}
				break;
			default:
				break;
		}
	}

	/**
	 * Updates `#cachedIds` after {@link SyncClientBridge} has already applied the same messages via `receiveSync`
	 * (e.g. `syncBatch`) so we do not double-apply.
	 */
	syncTrackedIdsFromMessages(changes: SyncMessage<TItem>[]): void {
		for (const change of changes) {
			switch (change.type) {
				case "insert":
					this.#cachedIds.add(partialSyncRowKey(change.value.id));
					break;
				case "update":
					this.#cachedIds.add(partialSyncRowKey(change.value.id));
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

	async #drainPendingCoalescedUpdates(): Promise<void> {
		if (this.#pendingCoalescedUpdatesByKey.size === 0) return;
		const batch = [...this.#pendingCoalescedUpdatesByKey.values()];
		this.#pendingCoalescedUpdatesByKey.clear();
		const get = this.options.collection.get;
		const toApply =
			get === undefined
				? batch
				: batch.map((ch) => {
						if (ch.type !== "update") return ch;
						const id = ch.value.id;
						const current =
							(typeof id === "string" || typeof id === "number"
								? get(id)
								: undefined) ?? get(partialSyncRowKey(id));
						if (current === undefined) return ch;
						return { ...ch, previousValue: current };
					});
		await this.#receiveSyncAndTrack(toApply);
	}

	/**
	 * Apply pending plain `rangePatch` updates coalesced by row id. Idempotent when the map is empty.
	 * Invoked automatically by `connectPartialSync` after each inbound pump drain.
	 */
	async flushPendingCoalescedInboundUpdates(): Promise<void> {
		await this.#drainPendingCoalescedUpdates();
	}

	async #receiveSyncAndTrack(changes: SyncMessage<TItem>[]): Promise<void> {
		if (changes.length === 0) return;
		await this.options.collection.utils.receiveSync(changes);
		this.syncTrackedIdsFromMessages(changes);
	}

	/**
	 * @param coalesceSameRowUpdates When true (plain `rangePatch` updates only), merge by row key;
	 * the transport layer must call `flushPendingCoalescedInboundUpdates` after processing queued inbound work.
	 */
	async #applyAndTrack(
		changes: SyncMessage<TItem>[],
		coalesceSameRowUpdates = false,
	): Promise<void> {
		if (changes.length === 0) return;

		if (!coalesceSameRowUpdates) {
			await this.#drainPendingCoalescedUpdates();
			await this.#receiveSyncAndTrack(changes);
			return;
		}

		for (const ch of changes) {
			if (ch.type !== "update") {
				await this.#drainPendingCoalescedUpdates();
				await this.#receiveSyncAndTrack(changes);
				return;
			}
			this.#pendingCoalescedUpdatesByKey.set(
				partialSyncRowKey(ch.value.id),
				ch,
			);
		}
	}

	#setState(state: PartialSyncState): void {
		this.#state = state;
		this.options.onStateChange?.(state);
	}
}
