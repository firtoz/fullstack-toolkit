import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
	clearOpfsRootEntriesWithPrefix,
	opfsSqliteFilePrefix,
	sqlitePaginationDbNameForE2e,
} from "./e2e-worker-db";
import { waitForDBReady, waitForQueryReady, waitForWorkerReady } from "./utils";

function sqlitePaginationUrl(testInfo: TestInfo): string {
	return `/collections/sqlite-pagination-test?mode=on-demand&e2eWorker=${testInfo.parallelIndex}`;
}

/**
 * E2E tests for SQLite limit/offset pagination
 *
 * These tests verify that the SQLite collection correctly uses native SQL
 * LIMIT/OFFSET clauses for efficient pagination instead of loading all data.
 *
 * Key differences from IndexedDB:
 * - SQLite uses native SQL LIMIT/OFFSET (efficient)
 * - IndexedDB has to load all data and slice in memory (inefficient for large datasets)
 *
 * The tests use the sqlite-pagination-test page which has:
 * - 20 test items with priorities 1-20
 * - "Load More" button for cursor-based pagination
 * - Page navigation for offset-based pagination
 */

async function clearPaginationOpfs(page: Page, testInfo: TestInfo): Promise<void> {
	await clearOpfsRootEntriesWithPrefix(
		page,
		opfsSqliteFilePrefix(sqlitePaginationDbNameForE2e(testInfo)),
	);
}

// Helper to get the number of items shown
async function getItemsShown(page: Page): Promise<number> {
	const text = await page.getByTestId("items-shown").textContent();
	const match = text?.match(/Items shown: (\d+)/);
	return match ? parseInt(match[1], 10) : 0;
}

// Helper to get displayed todo priorities
async function getDisplayedPriorities(
	page: Page,
	testIdPrefix: string,
): Promise<number[]> {
	const items = await page.locator(`[data-testid^="${testIdPrefix}"]`).all();
	const priorities: number[] = [];
	for (const item of items) {
		const text = await item.textContent();
		const match = text?.match(/priority: (\d+)/);
		if (match) {
			priorities.push(parseInt(match[1], 10));
		}
	}
	return priorities;
}

// Helper to check if LIMIT is in operations
async function operationsShowLimit(page: Page): Promise<boolean> {
	const operations = await page.getByTestId("sql-operations").textContent();
	return operations?.includes("limit") ?? false;
}

test.describe("SQLite Pagination - Cursor/Load More", () => {
	test.beforeEach(async ({ page }, testInfo) => {
		await page.goto("/");
		await clearPaginationOpfs(page, testInfo);
	});

	test("should load initial page with correct limit", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		// Wait for SQLite WASM worker to initialize
		await waitForWorkerReady(page);

		// Populate database with 20 items
		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		// Start cursor pagination test
		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Default page size is 5
		const itemsShown = await getItemsShown(page);
		expect(itemsShown).toBe(5);

		// Check ordering (ascending by default)
		const priorities = await getDisplayedPriorities(page, "todo-item-");
		expect(priorities).toEqual([1, 2, 3, 4, 5]);
	});

	test("should use native SQL LIMIT for pagination", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		// Clear operations
		await page.click('[data-testid="clear-operations"]');

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Check that operations show "limit" in context
		const hasLimit = await operationsShowLimit(page);
		expect(hasLimit).toBe(true);
	});

	test("should load more items when clicking load more button", async (
		{ page },
		testInfo,
	) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await waitForDBReady(page);
		await page.click('[data-testid="populate-db"]');
		await waitForDBReady(page);

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Initially 5 items
		expect(await getItemsShown(page)).toBe(5);

		// Click load more
		await page.click('[data-testid="load-more-button"]');
		await page.waitForTimeout(200);
		await waitForQueryReady(page);

		// Should now show 10 items
		expect(await getItemsShown(page)).toBe(10);

		// Verify correct priorities
		const priorities = await getDisplayedPriorities(page, "todo-item-");
		expect(priorities).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	});

	test("should continue loading more until all items are loaded", async (
		{ page },
		testInfo,
	) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Click load more 3 times (5 + 5 + 5 + 5 = 20)
		for (let i = 0; i < 3; i++) {
			await page.click('[data-testid="load-more-button"]');
			await waitForQueryReady(page);
		}

		// Should show all 20 items
		expect(await getItemsShown(page)).toBe(20);

		// At this point, hasMore is true because 20 === 20 (limit matches count)
		// Click one more time to trigger the "no more" detection (will request 25, get 20)
		await page.click('[data-testid="load-more-button"]');
		await waitForQueryReady(page);

		// Still 20 items (no more in DB)
		expect(await getItemsShown(page)).toBe(20);

		// Now "Load More" button should be hidden, "No more items" should show
		await expect(page.getByTestId("load-more-button")).not.toBeVisible();
		await expect(page.getByTestId("no-more-items")).toBeVisible();
	});

	test("should respect descending order with pagination", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		// Set descending order
		await page.selectOption('[data-testid="order-select"]', "desc");

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Should show highest priorities first
		const priorities = await getDisplayedPriorities(page, "todo-item-");
		expect(priorities).toEqual([20, 19, 18, 17, 16]);

		// Load more
		await page.click('[data-testid="load-more-button"]');
		await waitForQueryReady(page);

		const morePriorities = await getDisplayedPriorities(page, "todo-item-");
		expect(morePriorities).toEqual([20, 19, 18, 17, 16, 15, 14, 13, 12, 11]);
	});

	test("should work with different page sizes", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		// Set page size to 3
		await page.selectOption('[data-testid="page-size-select"]', "3");

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		expect(await getItemsShown(page)).toBe(3);

		await page.click('[data-testid="load-more-button"]');
		await waitForQueryReady(page);

		expect(await getItemsShown(page)).toBe(6);
	});
});

test.describe("SQLite Pagination - Offset/Page Navigation", () => {
	test.beforeEach(async ({ page }, testInfo) => {
		await page.goto("/");
		await clearPaginationOpfs(page, testInfo);
	});

	test("should display correct items on first page", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		await page.click('[data-testid="test-offset-pagination"]');
		await waitForQueryReady(page);

		// Check page info
		await expect(page.getByTestId("total-items")).toContainText(
			"Total items: 20",
		);
		await expect(page.getByTestId("current-offset")).toContainText(
			"Current offset: 0",
		);
		await expect(page.getByTestId("items-on-page")).toContainText(
			"Items on page: 5",
		);

		// Check priorities (first 5 in ascending order)
		const priorities = await getDisplayedPriorities(page, "offset-todo-item-");
		expect(priorities).toEqual([1, 2, 3, 4, 5]);
	});

	test("should navigate to next page with correct offset", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		await page.click('[data-testid="test-offset-pagination"]');
		await waitForQueryReady(page);

		// Go to page 2
		await page.click('[data-testid="next-page-button"]');
		await page.waitForTimeout(300);

		await expect(page.getByTestId("current-offset")).toContainText(
			"Current offset: 5",
		);
		await expect(page.getByTestId("page-indicator")).toContainText(
			"Page 2 of 4",
		);

		// Check priorities (items 6-10)
		const priorities = await getDisplayedPriorities(page, "offset-todo-item-");
		expect(priorities).toEqual([6, 7, 8, 9, 10]);
	});

	test("should navigate through all pages correctly", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		await page.click('[data-testid="test-offset-pagination"]');
		await waitForQueryReady(page);

		// Navigate to last page (page 4)
		for (let i = 0; i < 3; i++) {
			await page.click('[data-testid="next-page-button"]');
			await page.waitForTimeout(300);
		}

		await expect(page.getByTestId("page-indicator")).toContainText(
			"Page 4 of 4",
		);
		await expect(page.getByTestId("current-offset")).toContainText(
			"Current offset: 15",
		);

		// Check priorities (items 16-20)
		const priorities = await getDisplayedPriorities(page, "offset-todo-item-");
		expect(priorities).toEqual([16, 17, 18, 19, 20]);

		// Next button should be disabled
		await expect(page.getByTestId("next-page-button")).toBeDisabled();
	});

	test("should navigate backwards correctly", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		await page.click('[data-testid="test-offset-pagination"]');
		await waitForQueryReady(page);

		// Go to page 3
		await page.click('[data-testid="next-page-button"]');
		await page.click('[data-testid="next-page-button"]');
		await page.waitForTimeout(300);

		await expect(page.getByTestId("page-indicator")).toContainText(
			"Page 3 of 4",
		);

		// Go back to page 2
		await page.click('[data-testid="prev-page-button"]');
		await page.waitForTimeout(300);

		await expect(page.getByTestId("page-indicator")).toContainText(
			"Page 2 of 4",
		);
		await expect(page.getByTestId("current-offset")).toContainText(
			"Current offset: 5",
		);

		// Check priorities
		const priorities = await getDisplayedPriorities(page, "offset-todo-item-");
		expect(priorities).toEqual([6, 7, 8, 9, 10]);
	});

	test("should handle different page sizes", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		// Set page size to 10
		await page.selectOption('[data-testid="page-size-select"]', "10");

		await page.click('[data-testid="test-offset-pagination"]');
		await waitForQueryReady(page);

		await expect(page.getByTestId("items-on-page")).toContainText(
			"Items on page: 10",
		);
		await expect(page.getByTestId("page-indicator")).toContainText(
			"Page 1 of 2",
		);

		// Go to page 2
		await page.click('[data-testid="next-page-button"]');
		await page.waitForTimeout(300);

		await expect(page.getByTestId("current-offset")).toContainText(
			"Current offset: 10",
		);

		const priorities = await getDisplayedPriorities(page, "offset-todo-item-");
		expect(priorities).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
	});
});

test.describe("SQLite Pagination - Operations Tracking", () => {
	test.beforeEach(async ({ page }, testInfo) => {
		await page.goto("/");
		await clearPaginationOpfs(page, testInfo);
	});

	test("should show SQL operations with LIMIT in context", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		// Clear operations
		await page.click('[data-testid="clear-operations"]');

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Verify operations were logged and show limit
		const operationCount = await page
			.getByTestId("operation-count")
			.textContent();
		expect(operationCount).not.toBe("Total operations: 0");

		const operations = await page.getByTestId("sql-operations").textContent();
		expect(operations?.toLowerCase()).toContain("limit");
	});

	test("should return limited item count in operations", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		// Clear operations
		await page.click('[data-testid="clear-operations"]');

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// With page size 5 and limit query, should return 5 items (not all 20)
		// Look for "Returned: X items" in operations
		const operations = await page.getByTestId("sql-operations").textContent();
		// The operation should show a small number of items returned, not 20
		expect(operations).toMatch(/Returned: [0-5] items/);
	});
});

test.describe("SQLite Pagination - Edge Cases", () => {
	test.beforeEach(async ({ page }, testInfo) => {
		await page.goto("/");
		await clearPaginationOpfs(page, testInfo);
	});

	test("should handle empty database gracefully", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		// Don't populate, start with empty DB
		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		expect(await getItemsShown(page)).toBe(0);
		await expect(page.getByTestId("load-more-button")).not.toBeVisible();
	});

	test("should handle database clear during pagination", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Load more
		await page.click('[data-testid="load-more-button"]');
		await waitForQueryReady(page);

		expect(await getItemsShown(page)).toBe(10);

		// Clear test first
		await page.click('[data-testid="clear-test"]');
		await page.waitForSelector('[data-testid="no-test"]');

		// Clear database
		await page.click('[data-testid="clear-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');
		await page.waitForTimeout(500);

		// Re-start the test - should show 0 items
		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		expect(await getItemsShown(page)).toBe(0);
	});

	test("should handle switching between pagination modes", async ({ page }, testInfo) => {
		await page.goto(sqlitePaginationUrl(testInfo));
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');
		await waitForWorkerReady(page);

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		// Start with cursor pagination
		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Initial state should have 5 items
		expect(await getItemsShown(page)).toBe(5);

		await page.click('[data-testid="load-more-button"]');
		await page.waitForTimeout(500);
		await waitForQueryReady(page);

		expect(await getItemsShown(page)).toBe(10);

		// Switch to offset pagination
		await page.click('[data-testid="test-offset-pagination"]');
		await waitForQueryReady(page);

		await expect(page.getByTestId("page-indicator")).toContainText(
			"Page 1 of 4",
		);

		// Switch back to cursor pagination - should reset
		await page.click('[data-testid="test-cursor-pagination"]');
		await page.waitForTimeout(500);
		await waitForQueryReady(page);

		// Wait for query to re-run and get items
		await page.waitForSelector(
			'[data-testid="items-shown"]:not(:has-text("Items shown: 0"))',
		);
		expect(await getItemsShown(page)).toBe(5); // Reset to initial page size
	});
});
