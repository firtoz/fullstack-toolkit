import { describe, expect, it, beforeEach } from "bun:test";
import { z } from "zod";
import {
	keyvalCollectionOptions,
	createKeyValCollection,
} from "./keyvalCollection";
import type { KeyValAdapter } from "./keyvalCollection";

const todoSchema = z.object({
	id: z.string(),
	title: z.string(),
	completed: z.boolean(),
	createdAt: z.number(),
});

type Todo = z.infer<typeof todoSchema>;

function createInMemoryAdapter<T>(): KeyValAdapter<T> & {
	store: Map<string, T>;
} {
	const store = new Map<string, T>();
	return {
		store,
		get: async (key) => store.get(key) ?? null,
		set: async (key, value) => {
			store.set(key, value);
		},
		del: async (key) => {
			store.delete(key);
		},
		entries: async () => Array.from(store.entries()),
		clear: async () => {
			store.clear();
		},
	};
}

function createBatchAdapter<T>(): KeyValAdapter<T> & {
	store: Map<string, T>;
	setManyCalls: number;
	delManyCalls: number;
} {
	const store = new Map<string, T>();
	const adapter = {
		store,
		setManyCalls: 0,
		delManyCalls: 0,
		get: async (key: string) => store.get(key) ?? null,
		set: async (key: string, value: T) => {
			store.set(key, value);
		},
		del: async (key: string) => {
			store.delete(key);
		},
		entries: async () => Array.from(store.entries()),
		clear: async () => {
			store.clear();
		},
		setMany: async (entries: [string, T][]) => {
			adapter.setManyCalls++;
			for (const [key, value] of entries) {
				store.set(key, value);
			}
		},
		delMany: async (keys: string[]) => {
			adapter.delManyCalls++;
			for (const key of keys) {
				store.delete(key);
			}
		},
	};
	return adapter;
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: crypto.randomUUID(),
		title: "Test Todo",
		completed: false,
		createdAt: Date.now(),
		...overrides,
	};
}

async function waitForReady(collection: {
	isReady(): boolean;
	preload(): Promise<unknown>;
	onFirstReady(cb: () => void): unknown;
}): Promise<void> {
	if (collection.isReady()) return;
	collection.preload();
	await new Promise<void>((resolve) => {
		collection.onFirstReady(() => resolve());
	});
}

describe("keyvalCollectionOptions", () => {
	let adapter: ReturnType<typeof createInMemoryAdapter<Todo>>;

	beforeEach(() => {
		adapter = createInMemoryAdapter<Todo>();
	});

	it("creates a valid collection config", () => {
		const config = keyvalCollectionOptions({
			schema: todoSchema,
			adapter,
		});

		expect(config.schema).toBe(todoSchema);
		expect(config.getKey).toBeDefined();
		expect(config.sync).toBeDefined();
		expect(config.onInsert).toBeDefined();
		expect(config.onUpdate).toBeDefined();
		expect(config.onDelete).toBeDefined();
		expect(config.utils).toBeDefined();
	});

	it("uses default getKey (item.id)", () => {
		const config = keyvalCollectionOptions({
			schema: todoSchema,
			adapter,
		});

		const todo = makeTodo({ id: "abc-123" });
		expect(config.getKey(todo)).toBe("abc-123");
	});

	it("supports custom getKey", () => {
		const config = keyvalCollectionOptions({
			schema: todoSchema,
			adapter,
			getKey: (item) => `custom-${item.id}`,
		});

		const todo = makeTodo({ id: "abc" });
		expect(config.getKey(todo)).toBe("custom-abc");
	});
});

describe("createKeyValCollection", () => {
	let adapter: ReturnType<typeof createInMemoryAdapter<Todo>>;

	beforeEach(() => {
		adapter = createInMemoryAdapter<Todo>();
	});

	it("initializes with empty state", async () => {
		const collection = createKeyValCollection({
			schema: todoSchema,
			adapter,
		});

		await waitForReady(collection);

		expect(collection.toArray).toEqual([]);
	});

	it("loads pre-existing data from adapter on init (eager mode)", async () => {
		const todo = makeTodo({ id: "pre-1", title: "Pre-existing" });
		adapter.store.set("pre-1", todo);

		const collection = createKeyValCollection({
			schema: todoSchema,
			adapter,
		});

		await waitForReady(collection);
		await new Promise((r) => setTimeout(r, 50));

		expect(collection.toArray.length).toBe(1);
		expect(collection.toArray[0].title).toBe("Pre-existing");
	});

	describe("insert", () => {
		it("inserts a single item", async () => {
			const collection = createKeyValCollection({
				schema: todoSchema,
				adapter,
			});
			await waitForReady(collection);

			const todo = makeTodo({ id: "t1", title: "First" });
			const tx = collection.insert(todo);
			await tx.isPersisted.promise;

			expect(collection.toArray.length).toBe(1);
			expect(adapter.store.has("t1")).toBe(true);
			expect(adapter.store.get("t1")?.title).toBe("First");
		});

		it("inserts multiple items", async () => {
			const collection = createKeyValCollection({
				schema: todoSchema,
				adapter,
			});
			await waitForReady(collection);

			const todos = [
				makeTodo({ id: "t1", title: "One" }),
				makeTodo({ id: "t2", title: "Two" }),
				makeTodo({ id: "t3", title: "Three" }),
			];

			const tx = collection.insert(todos);
			await tx.isPersisted.promise;

			expect(collection.toArray.length).toBe(3);
			expect(adapter.store.size).toBe(3);
		});
	});

	describe("update", () => {
		it("updates an existing item", async () => {
			const todo = makeTodo({ id: "t1", title: "Original" });
			adapter.store.set("t1", todo);

			const collection = createKeyValCollection({
				schema: todoSchema,
				adapter,
			});
			await waitForReady(collection);
			await new Promise((r) => setTimeout(r, 50));

			const tx = collection.update("t1", (draft) => {
				draft.title = "Updated";
				draft.completed = true;
			});
			await tx.isPersisted.promise;

			const updated = adapter.store.get("t1");
			expect(updated?.title).toBe("Updated");
			expect(updated?.completed).toBe(true);
		});
	});

	describe("delete", () => {
		it("deletes an item", async () => {
			const todo = makeTodo({ id: "t1", title: "To Delete" });
			adapter.store.set("t1", todo);

			const collection = createKeyValCollection({
				schema: todoSchema,
				adapter,
			});
			await waitForReady(collection);
			await new Promise((r) => setTimeout(r, 50));

			const tx = collection.delete("t1");
			await tx.isPersisted.promise;

			expect(adapter.store.has("t1")).toBe(false);
			expect(collection.toArray.length).toBe(0);
		});

		it("deletes multiple items", async () => {
			adapter.store.set("t1", makeTodo({ id: "t1" }));
			adapter.store.set("t2", makeTodo({ id: "t2" }));
			adapter.store.set("t3", makeTodo({ id: "t3" }));

			const collection = createKeyValCollection({
				schema: todoSchema,
				adapter,
			});
			await waitForReady(collection);
			await new Promise((r) => setTimeout(r, 50));

			const tx = collection.delete(["t1", "t3"]);
			await tx.isPersisted.promise;

			expect(adapter.store.size).toBe(1);
			expect(adapter.store.has("t2")).toBe(true);
		});
	});

	describe("truncate", () => {
		it("clears all items from collection and adapter", async () => {
			adapter.store.set("t1", makeTodo({ id: "t1" }));
			adapter.store.set("t2", makeTodo({ id: "t2" }));

			const collection = createKeyValCollection({
				schema: todoSchema,
				adapter,
			});
			await waitForReady(collection);
			await new Promise((r) => setTimeout(r, 50));

			expect(collection.toArray.length).toBe(2);

			await collection.utils.truncate();

			expect(collection.toArray.length).toBe(0);
			expect(adapter.store.size).toBe(0);
		});
	});

	describe("receiveSync", () => {
		it("applies external insert messages", async () => {
			const collection = createKeyValCollection({
				schema: todoSchema,
				adapter,
			});
			await waitForReady(collection);

			const todo = makeTodo({ id: "sync-1", title: "Synced" });
			await collection.utils.receiveSync([{ type: "insert", value: todo }]);

			expect(collection.toArray.length).toBe(1);
			expect(collection.toArray[0].title).toBe("Synced");
		});

		it("applies external update messages", async () => {
			const original = makeTodo({ id: "sync-1", title: "Original" });
			adapter.store.set("sync-1", original);

			const collection = createKeyValCollection({
				schema: todoSchema,
				adapter,
			});
			await waitForReady(collection);
			await new Promise((r) => setTimeout(r, 50));

			const updated = { ...original, title: "Updated via sync" };
			await collection.utils.receiveSync([
				{ type: "update", value: updated, previousValue: original },
			]);

			const found = collection.toArray.find((t) => t.id === "sync-1");
			expect(found?.title).toBe("Updated via sync");
		});

		it("applies external delete messages", async () => {
			const todo = makeTodo({ id: "sync-1", title: "To delete" });
			adapter.store.set("sync-1", todo);

			const collection = createKeyValCollection({
				schema: todoSchema,
				adapter,
			});
			await waitForReady(collection);
			await new Promise((r) => setTimeout(r, 50));

			expect(collection.toArray.length).toBe(1);

			await collection.utils.receiveSync([{ type: "delete", key: "sync-1" }]);

			expect(collection.toArray.length).toBe(0);
		});

		it("ignores empty messages", async () => {
			const collection = createKeyValCollection({
				schema: todoSchema,
				adapter,
			});
			await waitForReady(collection);

			await collection.utils.receiveSync([]);
			expect(collection.toArray.length).toBe(0);
		});
	});
});

describe("batch adapter operations", () => {
	it("uses setMany when available for inserts", async () => {
		const adapter = createBatchAdapter<Todo>();

		const collection = createKeyValCollection({
			schema: todoSchema,
			adapter,
		});
		await waitForReady(collection);

		const todos = [
			makeTodo({ id: "b1", title: "Batch 1" }),
			makeTodo({ id: "b2", title: "Batch 2" }),
		];
		const tx = collection.insert(todos);
		await tx.isPersisted.promise;

		expect(adapter.setManyCalls).toBe(1);
		expect(adapter.store.size).toBe(2);
	});

	it("uses delMany when available for deletes", async () => {
		const adapter = createBatchAdapter<Todo>();
		adapter.store.set("b1", makeTodo({ id: "b1" }));
		adapter.store.set("b2", makeTodo({ id: "b2" }));

		const collection = createKeyValCollection({
			schema: todoSchema,
			adapter,
		});
		await waitForReady(collection);
		await new Promise((r) => setTimeout(r, 50));

		const tx = collection.delete(["b1", "b2"]);
		await tx.isPersisted.promise;

		expect(adapter.delManyCalls).toBe(1);
		expect(adapter.store.size).toBe(0);
	});

	it("falls back to sequential set when setMany not provided", async () => {
		const adapter = createInMemoryAdapter<Todo>();
		let setCalls = 0;
		const originalSet = adapter.set;
		adapter.set = async (key, value) => {
			setCalls++;
			return originalSet(key, value);
		};

		const collection = createKeyValCollection({
			schema: todoSchema,
			adapter,
		});
		await waitForReady(collection);

		const todos = [
			makeTodo({ id: "s1", title: "Seq 1" }),
			makeTodo({ id: "s2", title: "Seq 2" }),
		];
		const tx = collection.insert(todos);
		await tx.isPersisted.promise;

		expect(setCalls).toBe(2);
	});

	it("falls back to sequential del when delMany not provided", async () => {
		const adapter = createInMemoryAdapter<Todo>();
		adapter.store.set("d1", makeTodo({ id: "d1" }));
		adapter.store.set("d2", makeTodo({ id: "d2" }));

		let delCalls = 0;
		const originalDel = adapter.del;
		adapter.del = async (key) => {
			delCalls++;
			return originalDel(key);
		};

		const collection = createKeyValCollection({
			schema: todoSchema,
			adapter,
		});
		await waitForReady(collection);
		await new Promise((r) => setTimeout(r, 50));

		const tx = collection.delete(["d1", "d2"]);
		await tx.isPersisted.promise;

		expect(delCalls).toBe(2);
	});
});

describe("on-demand sync mode", () => {
	it("does not load data on init with on-demand syncMode", async () => {
		const adapter = createInMemoryAdapter<Todo>();
		adapter.store.set("lazy-1", makeTodo({ id: "lazy-1", title: "Lazy" }));

		const collection = createKeyValCollection({
			schema: todoSchema,
			adapter,
			syncMode: "on-demand",
		});
		await waitForReady(collection);
		await new Promise((r) => setTimeout(r, 50));

		expect(collection.toArray.length).toBe(0);
	});
});

describe("readyPromise", () => {
	it("waits for readyPromise before loading data", async () => {
		const adapter = createInMemoryAdapter<Todo>();
		adapter.store.set("r1", makeTodo({ id: "r1", title: "Ready" }));

		let resolveReady!: () => void;
		const readyPromise = new Promise<void>((resolve) => {
			resolveReady = resolve;
		});

		const collection = createKeyValCollection({
			schema: todoSchema,
			adapter,
			readyPromise,
		});

		collection.preload();
		await new Promise((r) => setTimeout(r, 50));

		expect(collection.isReady()).toBe(false);

		resolveReady();
		await waitForReady(collection);
		await new Promise((r) => setTimeout(r, 50));

		expect(collection.toArray.length).toBe(1);
	});
});
