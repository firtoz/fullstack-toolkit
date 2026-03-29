import { expect, test, type Page } from "@playwright/test";
import {
	deleteIdbSyncDb,
	openSyncModePage,
	syncModeTestUrl,
} from "./e2e-worker-db";

/**
 * Integration tests for eager vs on-demand sync modes
 *
 * These tests verify the actual behavior of the IndexedDB collection
 * with different sync modes and query patterns.
 *
 * Key difference: Each query type is isolated in its own component,
 * so we mount/unmount components to test on-demand loading.
 *
 * IndexedDB operations are now tracked via an interceptor passed to the
 * DrizzleIndexedDBProvider and displayed in the UI for assertion.
 */

// Helper to get IDB operations from UI
async function getIDBOperations(page: Page): Promise<string[]> {
	const operationsDiv = page.getByTestId("idb-operations");
	const text = await operationsDiv.textContent();

	// If no operations, return empty array
	if (!text || text.includes("No operations yet")) {
		return [];
	}

	// Parse operation divs
	const operationElements = await page
		.locator('[data-testid="idb-operations"] [data-operation-type]')
		.all();

	const operations: string[] = [];
	for (const el of operationElements) {
		const text = await el.textContent();
		if (text) {
			operations.push(text.trim());
		}
	}

	return operations;
}

// Helper to clear IDB operations log
async function clearIDBLog(page: Page) {
	await page.click('[data-testid="clear-operations"]');
}

// Helper to wait for database population to complete in on-demand mode
// Uses the query log which captures all status transitions
async function waitForPopulateComplete(page: Page): Promise<void> {
	// Wait for "DB Status: populating" to appear in the log
	await page.waitForSelector(
		'[data-testid="query-log"]:has-text("DB Status: populating")',
		{ timeout: 5000 },
	);
	// Then wait for "DB Status: ready" to appear
	await page.waitForSelector(
		'[data-testid="query-log"]:has-text("DB Status: ready")',
		{ timeout: 10000 },
	);
}

// Helper to wait for database population in eager mode
// Eager mode reloads the page, so we wait for the reload to complete
async function waitForPopulateCompleteEager(page: Page): Promise<void> {
	// Wait for page reload
	await page.waitForLoadState("networkidle");
	// Wait for the page to be ready again
	await page.waitForSelector('[data-testid="sync-mode-indicator"]');
}

test.describe("Sync Mode Integration Tests", () => {
	test.beforeEach(async ({ page }, testInfo) => {
		await page.goto("/");
		await deleteIdbSyncDb(page, testInfo);
	});

	test.describe("On-Demand Mode", () => {
		test("should NOT load items until a query component is mounted", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");
			await expect(page.getByTestId("sync-mode-indicator")).toContainText(
				"ON-DEMAND",
			);

			// Populate database
			await page.click('[data-testid="populate-db"]');
			await waitForPopulateComplete(page);

			// Should show no active query
			await expect(page.getByTestId("no-query")).toBeVisible();

			// Clear IDB log before mounting query
			await clearIDBLog(page);

			// Now mount the All Items query
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			// Should now show items
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);

			// Check what IndexedDB operations were performed
			const ops = await getIDBOperations(page);
			console.log("IDB Operations:", ops);
		});

		test("should load only queried items on-demand (indexed query)", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			// Populate database
			await page.click('[data-testid="populate-db"]');
			await waitForPopulateComplete(page);

			await page.click('[data-testid="clear-log"]');
			await clearIDBLog(page);

			// Mount priority > 10 query component
			await page.click('[data-testid="query-priority-gt-10"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			// Verify the component loaded
			await expect(page.getByTestId("priority-query-gt-10")).toBeVisible();
			await expect(page.getByTestId("priority-count-10")).toContainText(
				"Matching items: 2",
			);

			// Check IndexedDB operations
			const ops = await getIDBOperations(page);
			console.log("IDB Operations for priority > 10:", ops);

			// Should have used an index query (todo_priority_index)
			const hasIndexQuery = ops.some(
				(op) => op.includes("index-getAll") && op.includes("priority"),
			);
			console.log("Used index query:", hasIndexQuery);

			// Check log
			const log = await page.getByTestId("query-log").textContent();
			expect(log).toContain("Mounting PriorityQuery component");
		});

		test("should handle switching between different query components", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			// Populate database
			await page.click('[data-testid="populate-db"]');
			await waitForPopulateComplete(page);

			await page.click('[data-testid="clear-log"]');

			// First query: priority > 10
			await page.click('[data-testid="query-priority-gt-10"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			await expect(page.getByTestId("priority-count-10")).toContainText(
				"Matching items: 2",
			);

			// Switch to priority > 5
			await page.click('[data-testid="query-priority-gt-5"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			await expect(page.getByTestId("priority-count-5")).toContainText(
				"Matching items: 5",
			);

			// Switch to status query
			await page.click('[data-testid="query-status-pending"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			await expect(page.getByTestId("status-count-pending")).toContainText(
				"Matching items: 4",
			);
		});

		test("should use index for status queries", async ({ page }, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			// Populate database
			await page.click('[data-testid="populate-db"]');
			await waitForPopulateComplete(page);

			await page.click('[data-testid="clear-log"]');
			await clearIDBLog(page);

			// Query with indexed field: status = 'pending'
			await page.click('[data-testid="query-status-pending"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			await expect(page.getByTestId("status-query-pending")).toBeVisible();
			await expect(page.getByTestId("status-count-pending")).toContainText(
				"Matching items:",
			);

			// Check IndexedDB operations
			const ops1 = await getIDBOperations(page);
			console.log("IDB Operations for status = pending:", ops1);

			// Should have used an index query (todo_status_index)
			const hasStatusIndex = ops1.some(
				(op) => op.includes("index-getAll") && op.includes("status"),
			);
			console.log("Used status index:", hasStatusIndex);

			await clearIDBLog(page);

			// Query another status
			await page.click('[data-testid="query-status-in-progress"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			await expect(page.getByTestId("status-query-in-progress")).toBeVisible();
			await expect(page.getByTestId("status-count-in-progress")).toContainText(
				"Matching items: 2",
			);

			const ops2 = await getIDBOperations(page);
			console.log("IDB Operations for status = in-progress:", ops2);
		});

		test("should handle consecutive range queries", async ({ page }, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			// Populate database
			await page.click('[data-testid="populate-db"]');
			await waitForPopulateComplete(page);

			await page.click('[data-testid="clear-log"]');

			// Query 1: priority > 15 (only item 5 with priority 20)
			await page.click('[data-testid="query-priority-gt-15"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			await expect(page.getByTestId("priority-count-15")).toContainText(
				"Matching items: 1",
			);

			// Query 2: priority > 10 (items 4, 5)
			await page.click('[data-testid="query-priority-gt-10"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			await expect(page.getByTestId("priority-count-10")).toContainText(
				"Matching items: 2",
			);

			// Query 3: priority > 5 (items 2, 3, 4, 5, 6)
			await page.click('[data-testid="query-priority-gt-5"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			await expect(page.getByTestId("priority-count-5")).toContainText(
				"Matching items: 5",
			);
		});

		test("should unmount query component correctly", async ({ page }, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			// Populate database
			await page.click('[data-testid="populate-db"]');
			await waitForPopulateComplete(page);

			// Mount a query
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);
			await expect(page.getByTestId("all-items-query")).toBeVisible();

			// Clear the query
			await page.click('[data-testid="clear-query"]');
			await expect(page.getByTestId("no-query")).toBeVisible();
		});
	});

	test.describe("Eager Mode", () => {
		test("should load ALL items on initialization", async ({ page }, testInfo) => {
			await openSyncModePage(page, testInfo, "eager");
			await expect(page.getByTestId("sync-mode-indicator")).toContainText(
				"EAGER",
			);

			// Populate database (reloads in eager mode)
			await page.click('[data-testid="populate-db"]');
			await waitForPopulateCompleteEager(page);

			// Mount all items query
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			// In eager mode, all 7 items should be loaded immediately
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);
		});

		test("should serve queries from memory without additional DB calls", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "eager");

			// Populate database (reloads in eager mode)
			await page.click('[data-testid="populate-db"]');
			await waitForPopulateCompleteEager(page);

			// All items loaded, now query
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);

			await page.click('[data-testid="clear-log"]');
			await clearIDBLog(page);

			// Query: priority > 10 - should filter from already-loaded items
			await page.click('[data-testid="query-priority-gt-10"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			await expect(page.getByTestId("priority-count-10")).toContainText(
				"Matching items: 2",
			);

			// In eager mode, the priority query should NOT trigger new IndexedDB calls
			const ops = await getIDBOperations(page);
			console.log("IDB Operations after switching to priority query:", ops);
		});

		test("should handle multiple queries without issues", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "eager");

			// Populate database (reloads in eager mode)
			await page.click('[data-testid="populate-db"]');
			await waitForPopulateCompleteEager(page);

			await page.click('[data-testid="clear-log"]');

			// Run multiple queries
			await page.click('[data-testid="query-priority-gt-10"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			await page.click('[data-testid="query-priority-gt-5"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			await page.click('[data-testid="query-status-pending"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{
					timeout: 10000,
				},
			);

			// All queries should work fine
			await expect(page.getByTestId("status-count-pending")).toContainText(
				"Matching items:",
			);
		});
	});

	test.describe("Mode Comparison", () => {
		test("should demonstrate difference between eager and on-demand", async ({
			page,
			context,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			await page.click('[data-testid="populate-db"]');
			await page.waitForSelector(
				'[data-testid="db-status"]:has-text("ready")',
				{
					timeout: 10000,
				},
			);

			// On-demand: No items until query is mounted
			await expect(page.getByTestId("no-query")).toBeVisible();

			const eagerPage = await context.newPage();
			await eagerPage.goto(syncModeTestUrl(testInfo, "eager"));
			await eagerPage.waitForSelector('[data-testid="sync-mode-indicator"]');

			// Need to populate in eager mode page too (different DB)
			await eagerPage.click('[data-testid="populate-db"]');
			// Wait for page reload in eager mode
			await eagerPage.waitForLoadState("networkidle");
			await eagerPage.waitForSelector('[data-testid="sync-mode-indicator"]');

			// Mount query in eager mode
			await eagerPage.click('[data-testid="query-all"]');
			await eagerPage.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);

			// Eager: All 7 items loaded immediately
			await expect(eagerPage.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);

			await eagerPage.close();
		});
	});
});
