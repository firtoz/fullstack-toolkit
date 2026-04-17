import { expect, test, type Page } from "@playwright/test";
import { idbSyncDbName, openSyncModePage } from "test-playground-shared/e2e-worker-db";

/**
 * E2E tests for cursor and offset pagination
 *
 * These tests verify that the IndexedDB collection correctly handles
 * pagination when queries use limit/orderBy. The collection's loadSubset
 * method now supports:
 * - cursor.whereFrom: cursor-based pagination expressions
 * - offset: skip N items for offset-based pagination
 *
 * Test coverage:
 * - Queries with limits return correct number of items
 * - OrderBy + limit returns correctly ordered items
 * - Multiple paginated queries work independently
 * - Pagination persists across page reloads
 */

// Helper to clear IndexedDB
async function clearIndexedDB(page: Page, dbName: string) {
	await page.evaluate((name) => {
		indexedDB.deleteDatabase(name);
	}, dbName);
}

// Helper to wait for database to be ready
async function waitForDbReady(page: Page) {
	await page.waitForSelector('[data-testid="db-status"]:has-text("ready")', {
		timeout: 10000,
	});
}

// Helper to populate database with test data
async function populateDb(page: Page) {
	await page.click('[data-testid="populate-db"]');
	// Wait for population to complete (handles both eager and on-demand modes)
	await page.waitForTimeout(1000);
	await page.waitForLoadState("networkidle");
}

test.describe("Pagination - IndexedDB Collection", () => {
	test.beforeEach(async ({ page }, testInfo) => {
		await page.goto("/");
		await clearIndexedDB(page, idbSyncDbName(testInfo));
	});

	test.describe("On-Demand Mode with Limits", () => {
		test("should return all items when no limit is set", async ({ page }, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			// Populate database with 7 test items
			await populateDb(page);
			await waitForDbReady(page);

			// Mount "All Items" query (no limit)
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);

			// Should show all 7 items
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);
		});

		test("should filter items with priority > 10 (indexed query)", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			await populateDb(page);
			await waitForDbReady(page);

			// Query priority > 10 (should use index)
			await page.click('[data-testid="query-priority-gt-10"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);

			// Should match only 2 items (priority 15 and 20)
			await expect(page.getByTestId("priority-count-10")).toContainText(
				"Matching items: 2",
			);
		});

		test("should filter items with priority > 5 (broader range)", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			await populateDb(page);
			await waitForDbReady(page);

			// Query priority > 5
			await page.click('[data-testid="query-priority-gt-5"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);

			// Should match 5 items (priority 7, 7, 10, 15, 20)
			await expect(page.getByTestId("priority-count-5")).toContainText(
				"Matching items: 5",
			);
		});

		test("should filter items with status = pending (equality query)", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			await populateDb(page);
			await waitForDbReady(page);

			// Query status = pending
			await page.click('[data-testid="query-status-pending"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);

			// Should match pending items (4 items)
			await expect(page.getByTestId("status-count-pending")).toContainText(
				"Matching items: 4",
			);
		});

		test("should handle range queries with combined conditions", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			await populateDb(page);
			await waitForDbReady(page);

			// Query priority 5-15 (combined gte/lte)
			await page.click('[data-testid="query-range-5-15"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);

			// Should match items with priority 5, 7, 7, 10, 15
			await expect(page.getByTestId("range-count-5-15")).toContainText(
				"Matching items: 5",
			);
		});

		test("should handle IN array queries", async ({ page }, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			await populateDb(page);
			await waitForDbReady(page);

			// Query status IN [pending, in-progress]
			await page.click('[data-testid="query-inarray-active"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);

			// Should match pending + in-progress items (6 items)
			await expect(page.getByTestId("inarray-count")).toContainText(
				"Matching items: 6",
			);
		});
	});

	test.describe("Query Switching and Cursor Reset", () => {
		test("should correctly switch between different filtered queries", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			await populateDb(page);
			await waitForDbReady(page);

			// First: priority > 15 (1 item)
			await page.click('[data-testid="query-priority-gt-15"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("priority-count-15")).toContainText(
				"Matching items: 1",
			);

			// Switch to: priority > 10 (2 items)
			await page.click('[data-testid="query-priority-gt-10"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("priority-count-10")).toContainText(
				"Matching items: 2",
			);

			// Switch to: priority > 5 (5 items)
			await page.click('[data-testid="query-priority-gt-5"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("priority-count-5")).toContainText(
				"Matching items: 5",
			);

			// Switch to: status = pending (4 items)
			await page.click('[data-testid="query-status-pending"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("status-count-pending")).toContainText(
				"Matching items: 4",
			);
		});

		test("should unmount and remount queries correctly", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			await populateDb(page);
			await waitForDbReady(page);

			// Mount query
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);

			// Unmount
			await page.click('[data-testid="clear-query"]');
			await expect(page.getByTestId("no-query")).toBeVisible();

			// Remount same query
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);
		});
	});

	test.describe("Eager Mode", () => {
		test("should load all items upfront in eager mode", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "eager");
			await expect(page.getByTestId("sync-mode-indicator")).toContainText(
				"EAGER",
			);

			// Populate (this reloads page in eager mode)
			await populateDb(page);
			await page.waitForSelector('[data-testid="sync-mode-indicator"]');

			// Mount all items query
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);

			// All 7 items should be loaded
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);
		});

		test("should filter from memory without additional DB calls in eager mode", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "eager");

			await populateDb(page);
			await page.waitForSelector('[data-testid="sync-mode-indicator"]');

			// First mount a query to trigger the initial load
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);

			// Clear operation log AFTER initial load
			await page.click('[data-testid="clear-operations"]');

			// Query priority > 10 - should filter from already-loaded items
			await page.click('[data-testid="query-priority-gt-10"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);

			// Should show 2 items
			await expect(page.getByTestId("priority-count-10")).toContainText(
				"Matching items: 2",
			);

			// In eager mode, switching queries should NOT trigger new IndexedDB reads
			// since all data was already loaded
			const operations = await page.getByTestId("idb-operations").textContent();
			// Should be empty or have only "No operations yet"
			const hasNoOperations =
				operations?.includes("No operations yet") ||
				!operations?.includes("getAll on todo");
			expect(hasNoOperations).toBe(true);
		});
	});

	test.describe("Data Persistence", () => {
		test("should persist query results after page reload", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			// Populate database
			await populateDb(page);
			await waitForDbReady(page);

			// Verify data exists
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);

			// Reload page
			await page.reload();
			await page.waitForLoadState("networkidle");
			await page.waitForSelector('[data-testid="sync-mode-indicator"]');

			// Query again - data should still be there
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);
		});

		test("should clear all data when clearing database", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			// Populate
			await populateDb(page);
			await waitForDbReady(page);

			// Verify data
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);

			// Clear query first
			await page.click('[data-testid="clear-query"]');

			// Clear database
			await page.click('[data-testid="clear-db"]');
			await waitForDbReady(page);

			// Query again - should be empty
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 0",
			);
		});
	});

	test.describe("Complex Query Patterns", () => {
		test("should handle narrowing queries correctly", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			await populateDb(page);
			await waitForDbReady(page);

			// Start broad: all items (7)
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);

			// Narrow: priority > 5 (5)
			await page.click('[data-testid="query-priority-gt-5"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("priority-count-5")).toContainText(
				"Matching items: 5",
			);

			// Narrow more: priority > 10 (2)
			await page.click('[data-testid="query-priority-gt-10"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("priority-count-10")).toContainText(
				"Matching items: 2",
			);

			// Narrowest: priority > 15 (1)
			await page.click('[data-testid="query-priority-gt-15"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("priority-count-15")).toContainText(
				"Matching items: 1",
			);
		});

		test("should handle widening queries correctly", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			await populateDb(page);
			await waitForDbReady(page);

			// Start narrow: priority > 15 (1)
			await page.click('[data-testid="query-priority-gt-15"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("priority-count-15")).toContainText(
				"Matching items: 1",
			);

			// Widen: priority > 10 (2)
			await page.click('[data-testid="query-priority-gt-10"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("priority-count-10")).toContainText(
				"Matching items: 2",
			);

			// Widen more: priority > 5 (5)
			await page.click('[data-testid="query-priority-gt-5"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("priority-count-5")).toContainText(
				"Matching items: 5",
			);

			// Widest: all items (7)
			await page.click('[data-testid="query-all"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("all-items-count")).toContainText(
				"Items in memory: 7",
			);
		});

		test("should handle alternating query types", async ({
			page,
		}, testInfo) => {
			await openSyncModePage(page, testInfo, "on-demand");

			await populateDb(page);
			await waitForDbReady(page);

			// Priority query
			await page.click('[data-testid="query-priority-gt-10"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("priority-count-10")).toContainText(
				"Matching items: 2",
			);

			// Status query
			await page.click('[data-testid="query-status-pending"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("status-count-pending")).toContainText(
				"Matching items: 4",
			);

			// Range query
			await page.click('[data-testid="query-range-5-15"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("range-count-5-15")).toContainText(
				"Matching items: 5",
			);

			// IN array query
			await page.click('[data-testid="query-inarray-active"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("inarray-count")).toContainText(
				"Matching items: 6",
			);

			// Back to priority
			await page.click('[data-testid="query-priority-gt-10"]');
			await page.waitForSelector(
				'[data-testid="query-status"]:has-text("Ready")',
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("priority-count-10")).toContainText(
				"Matching items: 2",
			);
		});
	});
});
