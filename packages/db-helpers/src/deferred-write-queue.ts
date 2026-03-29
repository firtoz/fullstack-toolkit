import type { GenericSyncBackend } from "./generic-sync";

export type DeferredUpdateMutation<TItem extends object> = {
	key: string;
	changes: Partial<TItem>;
	original: TItem;
};

export type DeferredDeleteMutation<TItem extends object> = {
	key: string;
	modified: TItem;
	original: TItem;
};

type PendingRow<TItem extends object> =
	| { kind: "row"; value: TItem; insertedOnly: boolean }
	| { kind: "delete" };

function mergeUpdate<TItem extends object>(
	m: DeferredUpdateMutation<TItem>,
): TItem {
	return { ...m.original, ...m.changes } as TItem;
}

/**
 * Write-behind queue for local mutations: coalesces by persist key and flushes to a
 * {@link GenericSyncBackend} on an interval or when {@link flush} is called explicitly.
 */
export class DeferredWriteQueue<TItem extends object> {
	readonly #backend: GenericSyncBackend<TItem>;
	readonly #getPersistKey: (item: TItem) => string;
	readonly #flushIntervalMs: number;
	#pending = new Map<string, PendingRow<TItem>>();
	#intervalId: ReturnType<typeof setInterval> | null = null;
	#flushTail: Promise<void> = Promise.resolve();
	#disposed = false;

	constructor(options: {
		backend: GenericSyncBackend<TItem>;
		getPersistKey: (item: TItem) => string;
		flushIntervalMs?: number;
	}) {
		this.#backend = options.backend;
		this.#getPersistKey = options.getPersistKey;
		this.#flushIntervalMs = options.flushIntervalMs ?? 100;

		if (typeof globalThis !== "undefined") {
			globalThis.addEventListener?.("beforeunload", this.#onBeforeUnload);
			globalThis.addEventListener?.(
				"visibilitychange",
				this.#onVisibilityChange,
			);
		}

		this.#intervalId = setInterval(() => {
			void this.flush();
		}, this.#flushIntervalMs);
	}

	#onBeforeUnload = (): void => {
		void this.flush();
	};

	#onVisibilityChange = (): void => {
		const doc = (
			globalThis as typeof globalThis & {
				document?: { visibilityState?: string };
			}
		).document;
		if (doc?.visibilityState === "hidden") {
			void this.flush();
		}
	};

	enqueueInsert(items: TItem[]): void {
		if (this.#disposed || items.length === 0) return;
		for (const item of items) {
			const key = this.#getPersistKey(item);
			const cur = this.#pending.get(key);
			if (cur?.kind === "delete") {
				this.#pending.set(key, {
					kind: "row",
					value: item,
					insertedOnly: true,
				});
				continue;
			}
			if (cur?.kind === "row" && !cur.insertedOnly) {
				this.#pending.set(key, {
					kind: "row",
					value: item,
					insertedOnly: false,
				});
				continue;
			}
			this.#pending.set(key, { kind: "row", value: item, insertedOnly: true });
		}
	}

	enqueueUpdate(mutations: DeferredUpdateMutation<TItem>[]): void {
		if (this.#disposed || mutations.length === 0) return;
		for (const m of mutations) {
			const key = m.key;
			const value = mergeUpdate(m);
			const cur = this.#pending.get(key);
			if (cur?.kind === "delete") {
				this.#pending.set(key, { kind: "row", value, insertedOnly: false });
				continue;
			}
			if (cur?.kind === "row") {
				this.#pending.set(key, {
					kind: "row",
					value,
					insertedOnly: cur.insertedOnly,
				});
				continue;
			}
			this.#pending.set(key, { kind: "row", value, insertedOnly: false });
		}
	}

	enqueueDelete(mutations: DeferredDeleteMutation<TItem>[]): void {
		if (this.#disposed || mutations.length === 0) return;
		for (const m of mutations) {
			this.#pending.set(m.key, { kind: "delete" });
		}
	}

	/**
	 * Drains pending ops into the backend. Serialized so concurrent flushes chain.
	 */
	flush(): Promise<void> {
		this.#flushTail = this.#flushTail
			.catch(() => {})
			.then(() => this.#flushImpl());
		return this.#flushTail;
	}

	async #flushImpl(): Promise<void> {
		if (this.#pending.size === 0) return;
		const entries = [...this.#pending.entries()];
		this.#pending.clear();

		const deletePayload: DeferredDeleteMutation<TItem>[] = [];
		const toInsert: TItem[] = [];
		const toUpsert: TItem[] = [];

		for (const [key, op] of entries) {
			if (op.kind === "delete") {
				const id =
					Number.isFinite(Number(key)) && String(Number(key)) === key
						? Number(key)
						: key;
				const stub = { id } as TItem;
				deletePayload.push({
					key,
					modified: stub,
					original: stub,
				});
			} else if (op.insertedOnly) {
				toInsert.push(op.value);
			} else {
				toUpsert.push(op.value);
			}
		}

		if (deletePayload.length > 0) {
			await this.#backend.handleDelete(deletePayload);
		}
		if (toInsert.length > 0) {
			await this.#backend.handleInsert(toInsert);
		}
		if (toUpsert.length > 0) {
			if (this.#backend.handleBatchPut !== undefined) {
				await this.#backend.handleBatchPut(toUpsert);
			} else {
				await this.#backend.handleUpdate(
					toUpsert.map((value) => ({
						key: this.#getPersistKey(value),
						changes: value as Partial<TItem>,
						original: value,
					})),
				);
			}
		}
	}

	dispose(): void {
		if (this.#disposed) return;
		this.#disposed = true;
		if (this.#intervalId !== null) {
			clearInterval(this.#intervalId);
			this.#intervalId = null;
		}
		globalThis.removeEventListener?.("beforeunload", this.#onBeforeUnload);
		globalThis.removeEventListener?.(
			"visibilitychange",
			this.#onVisibilityChange,
		);
		void this.flush();
	}
}
