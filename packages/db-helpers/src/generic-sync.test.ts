import { describe, expect, it } from "bun:test";
import {
	createGenericSyncFunction,
	createGenericCollectionConfig,
} from "./generic-sync";
import type { GenericBaseSyncConfig, GenericSyncBackend } from "./generic-sync";
import type { SyncConfig, SyncConfigRes } from "@tanstack/db";
import { z } from "zod";

type Item = { id: string; name: string; value: number };

function createMockBackend(
	initialItems: Item[] = [],
): GenericSyncBackend<Item> & {
	insertedItems: Item[][];
	updatedMutations: Array<
		Array<{ key: string; changes: Partial<Item>; original: Item }>
	>;
	deletedMutations: Array<
		Array<{ key: string; modified: Item; original: Item }>
	>;
	truncateCalls: number;
} {
	const backend = {
		insertedItems: [] as Item[][],
		updatedMutations: [] as Array<
			Array<{ key: string; changes: Partial<Item>; original: Item }>
		>,
		deletedMutations: [] as Array<
			Array<{ key: string; modified: Item; original: Item }>
		>,
		truncateCalls: 0,

		initialLoad: async () => [...initialItems],
		loadSubset: async () => [...initialItems],
		handleInsert: async (items: Item[]) => {
			backend.insertedItems.push(items);
			return items;
		},
		handleUpdate: async (
			mutations: Array<{
				key: string;
				changes: Partial<Item>;
				original: Item;
			}>,
		) => {
			backend.updatedMutations.push(mutations);
			return mutations.map((m) => ({ ...m.original, ...m.changes }));
		},
		handleDelete: async (
			mutations: Array<{
				key: string;
				modified: Item;
				original: Item;
			}>,
		) => {
			backend.deletedMutations.push(mutations);
		},
		handleTruncate: async () => {
			backend.truncateCalls++;
		},
	};
	return backend;
}

type SyncParams = Parameters<SyncConfig<Item, string>["sync"]>[0];

function mockSyncParams(
	overrides: Partial<Omit<SyncParams, "collection">> = {},
): SyncParams {
	return {
		// biome-ignore lint/suspicious/noExplicitAny: mock — no real collection in unit tests
		collection: null as any,
		begin: () => {},
		write: () => {},
		commit: () => {},
		markReady: () => {},
		truncate: () => {},
		...overrides,
	};
}

describe("createGenericSyncFunction", () => {
	const baseConfig: GenericBaseSyncConfig = {
		readyPromise: Promise.resolve(),
		syncMode: "eager",
	};

	it("returns sync, onInsert, onUpdate, onDelete, utils", () => {
		const backend = createMockBackend();
		const result = createGenericSyncFunction(baseConfig, backend);

		expect(result.sync).toBeTypeOf("function");
		expect(result.onInsert).toBeTypeOf("function");
		expect(result.onUpdate).toBeTypeOf("function");
		expect(result.onDelete).toBeTypeOf("function");
		expect(result.utils).toBeDefined();
		expect(result.utils.truncate).toBeTypeOf("function");
		expect(result.utils.receiveSync).toBeTypeOf("function");
	});

	describe("sync lifecycle", () => {
		it("calls begin/write/commit with initial data on eager mode", async () => {
			const items: Item[] = [
				{ id: "1", name: "a", value: 1 },
				{ id: "2", name: "b", value: 2 },
			];
			const backend = createMockBackend(items);
			const result = createGenericSyncFunction(baseConfig, backend);

			const writes: Array<{ type: string; value?: Item }> = [];
			let beginCalled = false;
			let commitCalled = false;
			let readyCalled = false;

			result.sync(
				mockSyncParams({
					begin: () => {
						beginCalled = true;
					},
					write: (op) => {
						writes.push(op);
					},
					commit: () => {
						commitCalled = true;
					},
					markReady: () => {
						readyCalled = true;
					},
				}),
			);

			await new Promise((r) => setTimeout(r, 50));

			expect(beginCalled).toBe(true);
			expect(commitCalled).toBe(true);
			expect(readyCalled).toBe(true);
			expect(writes.length).toBe(2);
			expect(writes[0]).toEqual({ type: "insert", value: items[0] });
			expect(writes[1]).toEqual({ type: "insert", value: items[1] });
		});

		it("calls markReady immediately without loading data in on-demand mode", async () => {
			const items: Item[] = [{ id: "1", name: "a", value: 1 }];
			const backend = createMockBackend(items);
			const config: GenericBaseSyncConfig = {
				readyPromise: Promise.resolve(),
				syncMode: "on-demand",
			};
			const result = createGenericSyncFunction(config, backend);

			const writes: unknown[] = [];
			let readyCalled = false;

			result.sync(
				mockSyncParams({
					write: (op) => {
						writes.push(op);
					},
					markReady: () => {
						readyCalled = true;
					},
				}),
			);

			await new Promise((r) => setTimeout(r, 50));

			expect(readyCalled).toBe(true);
			expect(writes.length).toBe(0);
		});

		it("returns cleanup and loadSubset from sync", () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			const syncResult = result.sync(mockSyncParams()) as SyncConfigRes;

			expect(syncResult.cleanup).toBeTypeOf("function");
			expect(syncResult.loadSubset).toBeTypeOf("function");
		});
	});

	describe("onInsert handler", () => {
		it("throws if sync not yet called", async () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			expect(
				result.onInsert?.({
					// biome-ignore lint/suspicious/noExplicitAny: test mock
					transaction: { mutations: [] } as any,
					// biome-ignore lint/suspicious/noExplicitAny: test mock
					collection: null as any,
				}),
			).rejects.toThrow("insertListener not initialized");
		});

		it("delegates to backend.handleInsert after sync", async () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			const writes: unknown[] = [];
			result.sync(
				mockSyncParams({
					write: (op) => writes.push(op),
				}),
			);

			await new Promise((r) => setTimeout(r, 10));

			const item: Item = { id: "new-1", name: "new", value: 42 };
			await result.onInsert?.({
				transaction: {
					mutations: [{ modified: item }],
				},
				// biome-ignore lint/suspicious/noExplicitAny: test mock
			} as any);

			expect(backend.insertedItems.length).toBe(1);
			expect(backend.insertedItems[0]).toEqual([item]);
		});
	});

	describe("onUpdate handler", () => {
		it("delegates to backend.handleUpdate after sync", async () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			result.sync(mockSyncParams());
			await new Promise((r) => setTimeout(r, 10));

			const mutation = {
				key: "1",
				changes: { name: "updated" },
				original: { id: "1", name: "a", value: 1 },
			};

			await result.onUpdate?.({
				transaction: { mutations: [mutation] },
				// biome-ignore lint/suspicious/noExplicitAny: test mock
			} as any);

			expect(backend.updatedMutations.length).toBe(1);
			expect(backend.updatedMutations[0]).toEqual([mutation]);
		});
	});

	describe("onDelete handler", () => {
		it("delegates to backend.handleDelete after sync", async () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			result.sync(mockSyncParams());
			await new Promise((r) => setTimeout(r, 10));

			const mutation = {
				key: "1",
				modified: { id: "1", name: "a", value: 1 },
				original: { id: "1", name: "a", value: 1 },
			};

			await result.onDelete?.({
				transaction: { mutations: [mutation] },
				// biome-ignore lint/suspicious/noExplicitAny: test mock
			} as any);

			expect(backend.deletedMutations.length).toBe(1);
			expect(backend.deletedMutations[0]).toEqual([mutation]);
		});
	});

	describe("utils.truncate", () => {
		it("calls backend.handleTruncate and syncs truncate signal", async () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			let truncateSyncCalled = false;
			result.sync(
				mockSyncParams({
					truncate: () => {
						truncateSyncCalled = true;
					},
				}),
			);
			await new Promise((r) => setTimeout(r, 10));

			await result.utils.truncate();

			expect(backend.truncateCalls).toBe(1);
			expect(truncateSyncCalled).toBe(true);
		});

		it("throws if sync not called yet", async () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			expect(result.utils.truncate()).rejects.toThrow(
				"Sync functions not initialized",
			);
		});

		it("throws if backend has no handleTruncate", async () => {
			const backend = createMockBackend();
			const { handleTruncate, ...backendWithoutTruncate } = backend;
			const result = createGenericSyncFunction(
				baseConfig,
				backendWithoutTruncate,
			);

			result.sync(mockSyncParams());
			await new Promise((r) => setTimeout(r, 10));

			expect(result.utils.truncate()).rejects.toThrow("Truncate not supported");
		});
	});

	describe("utils.receiveSync", () => {
		it("applies insert messages via sync write", async () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			const writes: Array<{ type: string; value?: Item }> = [];
			result.sync(
				mockSyncParams({
					write: (op) => writes.push(op),
				}),
			);
			await new Promise((r) => setTimeout(r, 10));

			const item: Item = { id: "sync-1", name: "synced", value: 99 };
			await result.utils.receiveSync([{ type: "insert", value: item }]);

			const insertWrites = writes.filter(
				(w) => w.value && w.value.id === "sync-1",
			);
			expect(insertWrites.length).toBe(1);
			expect(insertWrites[0].type).toBe("insert");
		});

		it("waits for eager initialSync before receiveSync so remote snapshot cannot race initial inserts", async () => {
			const local: Item = { id: "local-1", name: "local", value: 1 };
			const remote: Item = { id: "remote-1", name: "remote", value: 2 };
			const backend: GenericSyncBackend<Item> = {
				...createMockBackend([local]),
				initialLoad: async () => {
					await new Promise((r) => setTimeout(r, 40));
					return [local];
				},
			};
			const result = createGenericSyncFunction(baseConfig, backend);

			const writes: Array<{ type: string; value?: Item }> = [];
			result.sync(
				mockSyncParams({
					write: (op) => writes.push(op),
				}),
			);

			const receivePromise = result.utils.receiveSync([
				{ type: "insert", value: remote },
			]);
			await receivePromise;

			const localIdx = writes.findIndex(
				(w) => w.value?.id === "local-1" && w.type === "insert",
			);
			const remoteIdx = writes.findIndex(
				(w) => w.value?.id === "remote-1" && w.type === "insert",
			);
			expect(localIdx).toBeGreaterThanOrEqual(0);
			expect(remoteIdx).toBeGreaterThanOrEqual(0);
			expect(localIdx).toBeLessThan(remoteIdx);
		});

		it("applies update messages via sync write", async () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			const writes: Array<{ type: string; value?: Item }> = [];
			result.sync(
				mockSyncParams({
					write: (op) => writes.push(op),
				}),
			);
			await new Promise((r) => setTimeout(r, 10));

			const item: Item = { id: "sync-1", name: "updated", value: 100 };
			const prev: Item = { id: "sync-1", name: "original", value: 99 };
			await result.utils.receiveSync([
				{ type: "update", value: item, previousValue: prev },
			]);

			const updateWrites = writes.filter(
				(w) => w.type === "update" && w.value && w.value.id === "sync-1",
			);
			expect(updateWrites.length).toBe(1);
		});

		it("applies delete messages via sync write", async () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			const writes: Array<{ type: string }> = [];
			result.sync(
				mockSyncParams({
					write: (op) => writes.push(op),
				}),
			);
			await new Promise((r) => setTimeout(r, 10));

			await result.utils.receiveSync([{ type: "delete", key: "sync-1" }]);

			const deleteWrites = writes.filter((w) => w.type === "delete");
			expect(deleteWrites.length).toBe(1);
		});

		it("applies truncate messages via sync truncate", async () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			let truncateSyncCalled = false;
			result.sync(
				mockSyncParams({
					truncate: () => {
						truncateSyncCalled = true;
					},
				}),
			);
			await new Promise((r) => setTimeout(r, 10));

			await result.utils.receiveSync([{ type: "truncate" }]);

			expect(truncateSyncCalled).toBe(true);
		});

		it("ignores empty messages array", async () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			let beginCalls = 0;
			result.sync(
				mockSyncParams({
					begin: () => beginCalls++,
				}),
			);
			await new Promise((r) => setTimeout(r, 10));
			const beforeCalls = beginCalls;

			await result.utils.receiveSync([]);

			expect(beginCalls).toBe(beforeCalls);
		});

		it("silently drops messages if sync not initialized", async () => {
			const backend = createMockBackend();
			const config: GenericBaseSyncConfig = {
				readyPromise: Promise.resolve(),
				debug: true,
			};
			const result = createGenericSyncFunction(config, backend);

			await result.utils.receiveSync([
				{
					type: "insert",
					value: { id: "1", name: "test", value: 1 },
				},
			]);
		});
	});

	describe("readyPromise", () => {
		it("waits for readyPromise before loading initial data", async () => {
			let resolveReady!: () => void;
			const readyPromise = new Promise<void>((resolve) => {
				resolveReady = resolve;
			});

			const items: Item[] = [{ id: "1", name: "a", value: 1 }];
			const backend = createMockBackend(items);
			const config: GenericBaseSyncConfig = {
				readyPromise,
				syncMode: "eager",
			};

			const result = createGenericSyncFunction(config, backend);
			const writes: unknown[] = [];

			result.sync(
				mockSyncParams({
					write: (op) => writes.push(op),
				}),
			);

			await new Promise((r) => setTimeout(r, 20));
			expect(writes.length).toBe(0);

			resolveReady();
			await new Promise((r) => setTimeout(r, 50));
			expect(writes.length).toBe(1);
		});
	});

	describe("cleanup", () => {
		it("clears listeners after cleanup", async () => {
			const backend = createMockBackend();
			const result = createGenericSyncFunction(baseConfig, backend);

			const syncResult = result.sync(mockSyncParams()) as SyncConfigRes;
			await new Promise((r) => setTimeout(r, 10));

			syncResult.cleanup?.();

			expect(
				result.onInsert?.({
					// biome-ignore lint/suspicious/noExplicitAny: test mock
					transaction: { mutations: [] } as any,
					// biome-ignore lint/suspicious/noExplicitAny: test mock
					collection: null as any,
				}),
			).rejects.toThrow("insertListener not initialized");
		});
	});
});

describe("createGenericCollectionConfig", () => {
	it("combines schema, getKey, sync into a collection config", () => {
		const schema = z.object({ id: z.string(), name: z.string() });
		const backend = createMockBackend();
		const baseConfig: GenericBaseSyncConfig = {
			readyPromise: Promise.resolve(),
		};
		const syncResult = createGenericSyncFunction(baseConfig, backend);

		const config = createGenericCollectionConfig({
			schema,
			getKey: (item) => item.id,
			syncResult,
		});

		expect(config.schema).toBe(schema);
		expect(config.getKey).toBeTypeOf("function");
		expect(config.sync).toBeDefined();
		expect(config.onInsert).toBeTypeOf("function");
		expect(config.onUpdate).toBeTypeOf("function");
		expect(config.onDelete).toBeTypeOf("function");
		expect(config.utils).toBeDefined();
		expect(config.utils.truncate).toBeTypeOf("function");
		expect(config.utils.receiveSync).toBeTypeOf("function");
	});

	it("respects custom onInsert/onUpdate/onDelete overrides", () => {
		const schema = z.object({ id: z.string() });
		const backend = createMockBackend();
		const baseConfig: GenericBaseSyncConfig = {
			readyPromise: Promise.resolve(),
		};
		const syncResult = createGenericSyncFunction(baseConfig, backend);

		const customOnInsert = async () => {};
		const customOnUpdate = async () => {};
		const customOnDelete = async () => {};

		const config = createGenericCollectionConfig({
			schema,
			getKey: (item) => item.id,
			syncResult,
			onInsert: customOnInsert,
			onUpdate: customOnUpdate,
			onDelete: customOnDelete,
		});

		expect(config.onInsert).toBe(customOnInsert);
		expect(config.onUpdate).toBe(customOnUpdate);
		expect(config.onDelete).toBe(customOnDelete);
	});

	it("passes syncMode through", () => {
		const schema = z.object({ id: z.string() });
		const backend = createMockBackend();
		const baseConfig: GenericBaseSyncConfig = {
			readyPromise: Promise.resolve(),
		};
		const syncResult = createGenericSyncFunction(baseConfig, backend);

		const config = createGenericCollectionConfig({
			schema,
			getKey: (item) => item.id,
			syncResult,
			syncMode: "on-demand",
		});

		expect(config.syncMode).toBe("on-demand");
	});
});
