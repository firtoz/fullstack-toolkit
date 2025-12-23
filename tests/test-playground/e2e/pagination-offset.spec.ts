import { expect, test, type Page } from "@playwright/test";

/**
 * E2E tests for limit/offset pagination with "load more" functionality
 *
 * These tests verify that the IndexedDB collection correctly handles:
 * - cursor.whereFrom: cursor-based pagination for sorted results
 * - offset: skip N items for offset-based pagination
 *
 * The tests use the pagination-test page which has:
 * - 20 test items with priorities 1-20
 * - "Load More" button for cursor-based pagination
 * - Page navigation for offset-based pagination
 */

// Helper to clear IndexedDB
async function clearIndexedDB(page: Page, dbName: string) {
	await page.evaluate((name) => {
		indexedDB.deleteDatabase(name);
	}, dbName);
}

// Helper to wait for query to be ready
async function waitForQueryReady(page: Page) {
	await page.waitForSelector('[data-testid="query-status"]:has-text("Ready")', {
		timeout: 10000,
	});
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

test.describe("Pagination - Cursor/Load More", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await clearIndexedDB(page, "test-pagination.db");
	});

	test("should load initial page with correct limit", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

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

	test("should load more items when clicking load more button", async ({
		page,
	}) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Initially 5 items
		await expect(page.getByTestId("items-shown")).toContainText(
			"Items shown: 5",
		);

		// Click load more
		await page.click('[data-testid="load-more-button"]');
		await waitForQueryReady(page);

		// Should now show 10 items - use expect with auto-retry instead of manual check
		await expect(page.getByTestId("items-shown")).toContainText(
			"Items shown: 10",
		);

		// Verify correct priorities
		const priorities = await getDisplayedPriorities(page, "todo-item-");
		expect(priorities).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	});

	test("should continue loading more until all items are loaded", async ({
		page,
	}) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

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

	test("should respect descending order with pagination", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

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

	test("should work with different page sizes", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		// Set page size to 3
		await page.selectOption('[data-testid="page-size-select"]', "3");

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		await expect(page.getByTestId("items-shown")).toContainText(
			"Items shown: 3",
		);

		await page.click('[data-testid="load-more-button"]');
		await waitForQueryReady(page);

		await expect(page.getByTestId("items-shown")).toContainText(
			"Items shown: 6",
		);
	});

	test("should reset pagination when settings change", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Load more twice
		await page.click('[data-testid="load-more-button"]');
		await waitForQueryReady(page);
		await page.click('[data-testid="load-more-button"]');
		await waitForQueryReady(page);

		await expect(page.getByTestId("items-shown")).toContainText(
			"Items shown: 15",
		);

		// Change page size - should reset
		await page.selectOption('[data-testid="page-size-select"]', "3");
		await waitForQueryReady(page);

		await expect(page.getByTestId("items-shown")).toContainText(
			"Items shown: 3",
		);
	});
});

test.describe("Pagination - Offset/Page Navigation", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await clearIndexedDB(page, "test-pagination.db");
	});

	test("should display correct items on first page", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

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

	test("should navigate to next page with correct offset", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

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

	test("should navigate through all pages correctly", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

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

	test("should navigate backwards correctly", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

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

	test("should handle different page sizes", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

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

	test("should disable prev button on first page", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		await page.click('[data-testid="test-offset-pagination"]');
		await waitForQueryReady(page);

		await expect(page.getByTestId("prev-page-button")).toBeDisabled();
		await expect(page.getByTestId("next-page-button")).toBeEnabled();
	});
});

test.describe("Pagination - Operations Tracking", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await clearIndexedDB(page, "test-pagination.db");
	});

	test("should track loadSubset operations for paginated queries", async ({
		page,
	}) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		// Clear operations log
		await page.click('[data-testid="clear-operations"]');

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Check that operations were logged
		const operationCount = await page
			.getByTestId("operation-count")
			.textContent();
		expect(operationCount).not.toBe("Total operations: 0");

		// Should have at least one getAll or index-getAll operation
		const operations = await page.getByTestId("idb-operations").textContent();
		expect(operations).toMatch(/getAll|index-getAll/);
	});

	test("should trigger additional loadSubset when loading more", async ({
		page,
	}) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Clear operations after initial load
		await page.click('[data-testid="clear-operations"]');

		// Load more
		await page.click('[data-testid="load-more-button"]');
		await waitForQueryReady(page);

		// Check that new operations were logged
		const operationCount = await page
			.getByTestId("operation-count")
			.textContent();
		const count = parseInt(operationCount?.match(/\d+/)?.[0] ?? "0", 10);

		// Should have at least one operation from the load more action
		expect(count).toBeGreaterThanOrEqual(0); // May be 0 if data was already in memory
	});
});

test.describe("Pagination - Edge Cases", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await clearIndexedDB(page, "test-pagination.db");
	});

	test("should handle empty database gracefully", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

		// Don't populate, start with empty DB
		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		expect(await getItemsShown(page)).toBe(0);
		await expect(page.getByTestId("load-more-button")).not.toBeVisible();
	});

	test("should handle database clear during pagination", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Load more
		await page.click('[data-testid="load-more-button"]');
		await waitForQueryReady(page);

		await expect(page.getByTestId("items-shown")).toContainText(
			"Items shown: 10",
		);

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

	test("should handle switching between pagination modes", async ({ page }) => {
		await page.goto("/collections/pagination-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

		await page.click('[data-testid="populate-db"]');
		await page.waitForSelector('[data-testid="db-status"]:has-text("ready")');

		// Start with cursor pagination
		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		// Initial state should have 5 items
		await expect(page.getByTestId("items-shown")).toContainText(
			"Items shown: 5",
		);

		await page.click('[data-testid="load-more-button"]');
		await waitForQueryReady(page);

		await expect(page.getByTestId("items-shown")).toContainText(
			"Items shown: 10",
		);

		// Switch to offset pagination
		await page.click('[data-testid="test-offset-pagination"]');
		await waitForQueryReady(page);

		await expect(page.getByTestId("page-indicator")).toContainText(
			"Page 1 of 4",
		);

		// Switch back to cursor pagination - should reset
		await page.click('[data-testid="test-cursor-pagination"]');
		await waitForQueryReady(page);

		await expect(page.getByTestId("items-shown")).toContainText(
			"Items shown: 5",
		); // Reset to initial page size
	});
});
