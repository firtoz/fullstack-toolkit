import type { Page, TestInfo } from "@playwright/test";

/**
 * Parallel Playwright workers share the same browser origin, so IndexedDB and
 * OPFS names must be partitioned by worker to avoid cross-test interference.
 */
export function idbSyncDbName(testInfo: TestInfo): string {
	return `test-sync-mode-w${testInfo.parallelIndex}.db`;
}

export function sqliteSyncDbName(testInfo: TestInfo): string {
	return `test-sqlite-sync-mode-w${testInfo.parallelIndex}.db`;
}

export function syncModeTestUrl(
	testInfo: TestInfo,
	mode: "on-demand" | "eager",
): string {
	return `/collections/sync-mode-test?mode=${mode}&e2eWorker=${testInfo.parallelIndex}`;
}

export function sqliteSyncModeTestUrl(
	testInfo: TestInfo,
	mode: "on-demand" | "eager",
): string {
	return `/collections/sqlite-sync-mode-test?mode=${mode}&e2eWorker=${testInfo.parallelIndex}`;
}

export async function deleteIdbSyncDb(
	page: Page,
	testInfo: TestInfo,
): Promise<void> {
	const name = idbSyncDbName(testInfo);
	await page.evaluate((n) => {
		indexedDB.deleteDatabase(n);
	}, name);
}

export async function openSyncModePage(
	page: Page,
	testInfo: TestInfo,
	mode: "on-demand" | "eager",
): Promise<void> {
	await page.goto(syncModeTestUrl(testInfo, mode));
	await page.waitForSelector('[data-testid="sync-mode-indicator"]');
}
