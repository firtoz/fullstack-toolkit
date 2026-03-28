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
