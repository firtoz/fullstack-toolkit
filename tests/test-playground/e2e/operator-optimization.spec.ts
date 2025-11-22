import { expect, test, type Page } from "@playwright/test";

/**
 * Tests to verify that TanStack DB correctly optimizes supported operators
 * by pushing them down to the backend (select-where), while unsupported
 * operators fall back to loading all data (select-all).
 *
 * IMPORTANT: If these tests start failing, it may indicate that TanStack DB
 * has added support for more operators in SUPPORTED_COLLECTION_FUNCS.
 * This would be GOOD NEWS - check the TanStack DB changelog and update
 * our implementation to take advantage of the new optimizations!
 *
 * Current SUPPORTED_COLLECTION_FUNCS (as of TanStack DB 0.5.0):
 * - eq, gt, lt, gte, lte, and, or, in, isNull, isUndefined, not
 *
 * Known unsupported (filtered in memory):
 * - like, ilike, ne, isNotNull
 */

// Helper to get operation types from the interceptor log
async function getOperationTypes(page: Page): Promise<string[]> {
	const operationElements = await page
		.locator('[data-testid="idb-operations"] [data-operation-type]')
		.all();

	const types: string[] = [];
	for (const el of operationElements) {
		const type = await el.getAttribute("data-operation-type");
		if (type) {
			types.push(type);
		}
	}

	return types;
}

// Helper to get SQLite operation types
async function getSQLOperationTypes(page: Page): Promise<string[]> {
	const operationElements = await page
		.locator('[data-testid="sql-operations"] [data-operation-type]')
		.all();

	const types: string[] = [];
	for (const el of operationElements) {
		const type = await el.getAttribute("data-operation-type");
		if (type) {
			types.push(type);
		}
	}

	return types;
}

async function clearOperations(page: Page) {
	await page.click('[data-testid="clear-operations"]');
}

// Helper to wait for database population to complete
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

test.describe("IndexedDB Operator Optimization", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.evaluate(() => {
			indexedDB.deleteDatabase("test-sync-mode.db");
		});
		await page.goto("/collections/sync-mode-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

		// Populate database
		await page.click('[data-testid="populate-db"]');
		await waitForPopulateComplete(page);
	});

	test("GT operator should use index (select-where or index-getAll)", async ({
		page,
	}) => {
		await clearOperations(page);
		await page.click('[data-testid="query-priority-gt-10"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getOperationTypes(page);
		console.log("GT operation types:", types);

		// Should NOT do select-all (should use index)
		expect(types).not.toContain("getAll");
		// Should use index-getAll
		expect(types).toContain("index-getAll");
	});

	test("EQ operator should use index (select-where or index-getAll)", async ({
		page,
	}) => {
		await clearOperations(page);
		await page.click('[data-testid="query-status-pending"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getOperationTypes(page);
		console.log("EQ operation types:", types);

		// Should NOT do select-all (should use index)
		expect(types).not.toContain("getAll");
		// Should use index-getAll
		expect(types).toContain("index-getAll");
	});

	test("Range query (GTE + LTE + AND) should use index or select-all with in-memory filter", async ({
		page,
	}) => {
		await clearOperations(page);
		await page.click('[data-testid="query-range-5-15"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getOperationTypes(page);
		console.log("Range query operation types:", types);

		// Range queries are complex - may or may not use indexes
		// Just verify we got results
		await expect(page.getByTestId("range-count-5-15")).toContainText(
			"Matching items:",
		);
	});

	test("IN array operator should be optimized (if supported)", async ({
		page,
	}) => {
		await clearOperations(page);
		await page.click('[data-testid="query-inarray-active"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getOperationTypes(page);
		console.log("IN array operation types:", types);

		// IN is in SUPPORTED_COLLECTION_FUNCS but may fall back to select-all
		// depending on IndexedDB capabilities
		await expect(page.getByTestId("inarray-count")).toContainText(
			"Matching items:",
		);
	});

	test("LIKE operator should ALWAYS use select-all (not optimized)", async ({
		page,
	}) => {
		await clearOperations(page);
		await page.click('[data-testid="query-like-task"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getOperationTypes(page);
		console.log("LIKE operation types:", types);

		// LIKE is NOT in SUPPORTED_COLLECTION_FUNCS
		// Should ALWAYS do select-all and filter in memory
		expect(types).toContain("getAll");
		expect(types).not.toContain("index-getAll");

		// If this starts failing (no getAll), check if TanStack DB added LIKE support!
	});
});

// Helper to clear OPFS using the worker-based clear-opfs page
// OPFS file operations MUST be done from a worker context, not main thread
async function clearOPFSViaWorker(page: Page): Promise<void> {
	await page.goto("/api/clear-opfs");
	await page.waitForSelector('button:has-text("Clear All OPFS Data")');
	await page.click('button:has-text("Clear All OPFS Data")');
	await page.waitForSelector("text=Successfully cleared", { timeout: 10000 });
}

test.describe("SQLite Operator Optimization", () => {
	test.beforeEach(async ({ page }) => {
		// Clear OPFS from worker context
		await clearOPFSViaWorker(page);

		// Navigate to test page
		await page.goto("/collections/sqlite-sync-mode-test?mode=on-demand");
		await page.waitForSelector('[data-testid="sync-mode-indicator"]');

		// Wait for SQLite worker to be ready with database initialized
		// The page tests the database with a query to ensure it's actually ready
		await page.waitForSelector(
			'[data-testid="query-log"]:has-text("SQLite Worker: ready (database initialized")',
			{ timeout: 15000 },
		);

		// Populate database (no reload in on-demand mode)
		await page.click('[data-testid="populate-db"]');
		await waitForPopulateComplete(page);
	});

	test("GT operator should use select-where (SQL WHERE clause)", async ({
		page,
	}) => {
		await clearOperations(page);
		await page.click('[data-testid="query-priority-gt-10"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getSQLOperationTypes(page);
		console.log("SQLite GT operation types:", types);

		// Should use select-where (SQL WHERE clause)
		expect(types).toContain("select-where");
		expect(types).not.toContain("select-all");
	});

	test("LT operator should use select-where (SQL WHERE clause)", async ({
		page,
	}) => {
		await clearOperations(page);
		await page.click('[data-testid="query-priority-lt-10"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getSQLOperationTypes(page);
		console.log("SQLite LT operation types:", types);

		// Should use select-where
		expect(types).toContain("select-where");
		expect(types).not.toContain("select-all");
	});

	test("EQ operator should use select-where (SQL WHERE clause)", async ({
		page,
	}) => {
		await clearOperations(page);
		await page.click('[data-testid="query-status-pending"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getSQLOperationTypes(page);
		console.log("SQLite EQ operation types:", types);

		// Should use select-where
		expect(types).toContain("select-where");
		expect(types).not.toContain("select-all");
	});

	test("Range query (GTE + LTE + AND) should use select-where", async ({
		page,
	}) => {
		await clearOperations(page);
		await page.click('[data-testid="query-range-5-15"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getSQLOperationTypes(page);
		console.log("SQLite Range query operation types:", types);

		// Complex AND queries with GTE/LTE should still use select-where
		expect(types).toContain("select-where");
		expect(types).not.toContain("select-all");
	});

	test("Complex AND query should use select-where", async ({ page }) => {
		await clearOperations(page);
		await page.click('[data-testid="query-complex-and"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getSQLOperationTypes(page);
		console.log("SQLite Complex AND operation types:", types);

		// AND is supported
		expect(types).toContain("select-where");
		expect(types).not.toContain("select-all");
	});

	test("IS NULL operator should use select-where", async ({ page }) => {
		await clearOperations(page);
		await page.click('[data-testid="query-isnull"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getSQLOperationTypes(page);
		console.log("SQLite IS NULL operation types:", types);

		// isNull is supported
		expect(types).toContain("select-where");
		expect(types).not.toContain("select-all");
	});

	test("IN array operator should use select-where", async ({ page }) => {
		await clearOperations(page);
		await page.click('[data-testid="query-inarray-active"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getSQLOperationTypes(page);
		console.log("SQLite IN array operation types:", types);

		// IN is supported
		expect(types).toContain("select-where");
		expect(types).not.toContain("select-all");
	});

	test("LIKE operator should ALWAYS use select-all (not pushed down)", async ({
		page,
	}) => {
		await clearOperations(page);
		await page.click('[data-testid="query-like-task"]');
		await page.waitForSelector(
			'[data-testid="query-status"]:has-text("Ready")',
			{
				timeout: 10000,
			},
		);

		const types = await getSQLOperationTypes(page);
		console.log("SQLite LIKE operation types:", types);

		// LIKE is NOT in SUPPORTED_COLLECTION_FUNCS
		// TanStack DB will NOT push it to the backend
		// Should do select-all and filter in memory
		expect(types).toContain("select-all");
		expect(types).not.toContain("select-where");

		// ⚠️ IF THIS TEST FAILS: TanStack DB may have added LIKE to SUPPORTED_COLLECTION_FUNCS!
		// Check the changelog and update our SQLite collection to handle it more efficiently.
	});
});
