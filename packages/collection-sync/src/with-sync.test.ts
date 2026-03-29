import { describe, expect, it, mock } from "bun:test";
import type { AnyWithSyncableCollectionConfig } from "./with-sync";
import { withSync } from "./with-sync";

describe("withSync forwardTruncateToMutations", () => {
	it("does not enqueue truncate when false", async () => {
		const receiveSync = mock(async () => {});
		const originalTruncate = mock(async () => {});
		const baseOptions = {
			getKey: (row: { id: string }) => row.id,
			utils: {
				receiveSync,
				truncate: originalTruncate,
			},
		} as unknown as AnyWithSyncableCollectionConfig;

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
		const baseOptions = {
			getKey: (row: { id: string }) => row.id,
			utils: {
				receiveSync,
				truncate: originalTruncate,
			},
		} as unknown as AnyWithSyncableCollectionConfig;

		const { options, bridge } = withSync(baseOptions, {
			forwardTruncateToMutations: true,
			syncStateStorage: null,
		});

		await options.utils.truncate();
		expect(bridge.pendingCount).toBe(1);
	});
});

describe("withSync local mutation ordering", () => {
	it("invokes transport send before awaiting base onUpdate", async () => {
		let releaseBackend: (() => void) | undefined;
		const backendGate = new Promise<void>((resolve) => {
			releaseBackend = resolve;
		});
		const baseOnUpdate = mock(async () => {
			await backendGate;
		});
		const baseOptions = {
			getKey: (row: { id: string }) => row.id,
			onUpdate: baseOnUpdate,
			utils: {
				receiveSync: mock(async () => {}),
				truncate: mock(async () => {}),
			},
		} as unknown as AnyWithSyncableCollectionConfig;

		const sent: unknown[] = [];
		const { options, bridge, setTransportSend } = withSync(baseOptions, {
			syncStateStorage: null,
			sendSyncHelloOnConnect: false,
		});
		setTransportSend((msg) => {
			sent.push(msg);
		});
		bridge.setConnected(true);

		const done = options.onUpdate?.({
			transaction: {
				mutations: [
					{
						key: "1",
						changes: { title: "n" },
						original: { id: "1", title: "o", updatedAt: 1 },
						modified: { id: "1", title: "n", updatedAt: 2 },
					},
				],
			},
			// biome-ignore lint/suspicious/noExplicitAny: mock collection
			collection: null as any,
		});

		expect(sent.length).toBeGreaterThan(0);
		releaseBackend?.();
		await done;
		expect(baseOnUpdate).toHaveBeenCalledTimes(1);
	});
});
