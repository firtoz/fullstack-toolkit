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

/** OPFS entry names for sqlite-wasm are `${dbName}.sqlite3` (plus possible -wal/-shm suffixes). */
export function opfsSqliteFilePrefix(dbName: string): string {
	return `${dbName}.sqlite3`;
}

/**
 * Removes only root OPFS entries whose names start with `prefix` (for parallel Playwright workers).
 */
export async function clearOpfsRootEntriesWithPrefix(
	page: Page,
	prefix: string,
): Promise<void> {
	await page.evaluate(async (p: string) => {
		try {
			const root = await navigator.storage.getDirectory();
			for await (const entry of root.values()) {
				if (entry.name.startsWith(p)) {
					try {
						await root.removeEntry(entry.name, { recursive: true });
					} catch (e) {
						console.log(`Failed to remove ${entry.name}:`, e);
					}
				}
			}
		} catch (e) {
			console.log("Failed to clear OPFS prefix:", e);
		}
	}, prefix);
}

export function sqlitePlaygroundDbNameForE2e(testInfo: TestInfo): string {
	return `test-w${testInfo.parallelIndex}.db`;
}

export function indexeddbPlaygroundDbNameForE2e(testInfo: TestInfo): string {
	return `test-indexeddb-w${testInfo.parallelIndex}.db`;
}

export function sqlitePaginationDbNameForE2e(testInfo: TestInfo): string {
	return `test-sqlite-pagination-w${testInfo.parallelIndex}.db`;
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
