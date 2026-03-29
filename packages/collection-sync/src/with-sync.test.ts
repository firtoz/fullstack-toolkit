import { describe, expect, it, mock } from "bun:test";
import type {
	Collection,
	PendingMutation,
	TransactionWithMutations,
	UtilsRecord,
} from "@tanstack/db";
import { createTransaction } from "@tanstack/db";
import type {
	SyncableCollectionItem,
	WithSyncableCollectionConfig,
} from "./with-sync";
import { withSync } from "./with-sync";

type TruncateTestRow = { id: string; updatedAt: number };

function minimalSyncableConfig<T extends SyncableCollectionItem>(
	overrides: Omit<
		WithSyncableCollectionConfig<T, string, never, UtilsRecord>,
		"sync" | "getKey"
	> & { getKey?: (row: T) => string },
): WithSyncableCollectionConfig<T, string, never, UtilsRecord> {
	return {
		getKey: (row) => String(row.id),
		sync: { sync: () => {} },
		...overrides,
	};
}

describe("withSync forwardTruncateToMutations", () => {
	it("does not enqueue truncate when false", async () => {
		const receiveSync = mock(async () => {});
		const originalTruncate = mock(async () => {});
		const baseOptions = minimalSyncableConfig<TruncateTestRow>({
			utils: {
				receiveSync,
				truncate: originalTruncate,
			},
		});

		const { options, bridge } = withSync(baseOptions, {
			forwardTruncateToMutations: false,
			syncStateStorage: null,
		});

		await options.utils.truncate();
		expect(originalTruncate).toHaveBeenCalledTimes(1);
		expect(bridge.pendingCount).toBe(0);
	});

	it("enqueues truncate when true", async () => {
		const receiveSync = mock(async () => {});
		const originalTruncate = mock(async () => {});
		const baseOptions = minimalSyncableConfig<TruncateTestRow>({
			utils: {
				receiveSync,
				truncate: originalTruncate,
			},
		});

		const { options, bridge } = withSync(baseOptions, {
			forwardTruncateToMutations: true,
			syncStateStorage: null,
		});

		await options.utils.truncate();
		expect(bridge.pendingCount).toBe(1);
	});
});

type TestRow = { id: string; title: string; updatedAt: number };

function testUpdatePendingMutation(
	collection: Collection<TestRow, string, UtilsRecord>,
): PendingMutation<TestRow, "update"> {
	const original: TestRow = { id: "1", title: "o", updatedAt: 1 };
	const modified: TestRow = { id: "1", title: "n", updatedAt: 2 };
	return {
		mutationId: "test-mutation",
		original,
		modified,
		changes: { title: "n" },
		globalKey: "test-global-key",
		key: "1",
		type: "update",
		metadata: undefined,
		syncMetadata: {},
		optimistic: true,
		createdAt: new Date(0),
		updatedAt: new Date(0),
		collection,
	};
}

describe("withSync local mutation ordering", () => {
	it("invokes transport send before awaiting base onUpdate", async () => {
		let releaseBackend: (() => void) | undefined;
		const backendGate = new Promise<void>((resolve) => {
			releaseBackend = resolve;
		});
		const baseOnUpdate = mock(async () => {
			await backendGate;
		});
		const baseOptions = minimalSyncableConfig<TestRow>({
			onUpdate: baseOnUpdate,
			utils: {
				receiveSync: mock(async () => {}),
				truncate: mock(async () => {}),
			},
		});

		const sent: unknown[] = [];
		const { options, bridge, setTransportSend } = withSync(baseOptions, {
			syncStateStorage: null,
			sendSyncHelloOnConnect: false,
		});
		setTransportSend((msg) => {
			sent.push(msg);
		});
		bridge.setConnected(true);

		const stubCollection = {} as Collection<TestRow, string, UtilsRecord>;
		const mutation = testUpdatePendingMutation(stubCollection);
		const tx = createTransaction<TestRow>({
			mutationFn: async () => {},
			autoCommit: false,
		});
		tx.applyMutations([mutation]);

		const done = options.onUpdate?.({
			transaction: tx as TransactionWithMutations<TestRow, "update">,
			collection: stubCollection,
		});

		expect(sent.length).toBeGreaterThan(0);
		releaseBackend?.();
		await done;
		expect(baseOnUpdate).toHaveBeenCalledTimes(1);
	});
});
