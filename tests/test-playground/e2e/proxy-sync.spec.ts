import { expect, test, type Page } from "@playwright/test";

/**
 * Integration tests for the IDB Proxy multi-client sync system
 *
 * These tests verify that:
 * 1. Multiple clients can connect to the same proxy server
 * 2. Insert, update, delete operations sync across all clients
 * 3. Truncate (clear all) syncs across all clients
 * 4. New clients load existing data
 */

// Helper to get todo count from a client
async function getTodoCount(page: Page, clientId: string): Promise<number> {
	const badge = page.locator(`[data-testid="client-${clientId}"] span`).first();
	const text = await badge.textContent();
	const match = text?.match(/(\d+) todos?/);
	return match ? parseInt(match[1], 10) : 0;
}

// Helper to wait for todo count to reach expected value
async function waitForTodoCount(
	page: Page,
	clientId: string,
	expectedCount: number,
	timeout = 5000,
): Promise<void> {
	await expect(async () => {
		const count = await getTodoCount(page, clientId);
		expect(count).toBe(expectedCount);
	}).toPass({ timeout });
}

// Helper to get all todo titles from a client
async function getTodoTitles(page: Page, clientId: string): Promise<string[]> {
	const todoButtons = page.locator(
		`[data-testid="client-${clientId}"] ul button[title="Click to edit"]`,
	);
	const count = await todoButtons.count();
	const titles: string[] = [];
	for (let i = 0; i < count; i++) {
		const text = await todoButtons.nth(i).textContent();
		if (text) titles.push(text);
	}
	return titles;
}

// Helper to check if a todo is completed
async function isTodoCompleted(
	page: Page,
	clientId: string,
	todoIndex: number,
): Promise<boolean> {
	const checkbox = page
		.locator(`[data-testid="client-${clientId}"] ul li`)
		.nth(todoIndex)
		.locator('input[type="checkbox"]');
	return checkbox.isChecked();
}

test.describe("IDB Proxy Multi-Client Sync", () => {
	test.beforeEach(async ({ page }) => {
		// Clear IndexedDB before each test
		await page.goto("/");
		await page.evaluate(() => {
			indexedDB.deleteDatabase("proxy-sync-test.db");
		});
	});

	test.describe("Basic Sync Operations", () => {
		test("should start with 2 clients both showing 0 todos", async ({
			page,
		}) => {
			await page.goto("/collections/proxy-test");
			await page.waitForSelector('[data-testid="client-1"]');
			await page.waitForSelector('[data-testid="client-2"]');

			// Both clients should show 0 todos
			await waitForTodoCount(page, "1", 0);
			await waitForTodoCount(page, "2", 0);
		});

		test("should sync insert from Client 1 to Client 2", async ({ page }) => {
			await page.goto("/collections/proxy-test");
			await page.waitForSelector('[data-testid="client-1"]');
			await page.waitForSelector('[data-testid="client-2"]');

			// Wait for initial ready state
			await waitForTodoCount(page, "1", 0);
			await waitForTodoCount(page, "2", 0);

			// Add todo from Client 1
			await page.click('[data-testid="add-todo-1"]');

			// Both clients should now have 1 todo
			await waitForTodoCount(page, "1", 1);
			await waitForTodoCount(page, "2", 1);

			// Verify the todo appears in both clients
			const titles1 = await getTodoTitles(page, "1");
			const titles2 = await getTodoTitles(page, "2");
			expect(titles1.length).toBe(1);
			expect(titles2.length).toBe(1);
			expect(titles1[0]).toContain("Client 1");
			expect(titles2[0]).toContain("Client 1");
		});

		test("should sync insert from Client 2 to Client 1", async ({ page }) => {
			await page.goto("/collections/proxy-test");
			await page.waitForSelector('[data-testid="client-1"]');
			await page.waitForSelector('[data-testid="client-2"]');

			await waitForTodoCount(page, "1", 0);
			await waitForTodoCount(page, "2", 0);

			// Add todo from Client 2
			await page.click('[data-testid="add-todo-2"]');

			// Both clients should now have 1 todo
			await waitForTodoCount(page, "1", 1);
			await waitForTodoCount(page, "2", 1);

			// Verify it shows "Client 2" in the title
			const titles1 = await getTodoTitles(page, "1");
			expect(titles1[0]).toContain("Client 2");
		});

		test("should sync multiple inserts from different clients", async ({
			page,
		}) => {
			await page.goto("/collections/proxy-test");
			await page.waitForSelector('[data-testid="client-1"]');
			await page.waitForSelector('[data-testid="client-2"]');

			await waitForTodoCount(page, "1", 0);

			// Add from Client 1
			await page.click('[data-testid="add-todo-1"]');
			await waitForTodoCount(page, "1", 1);
			await waitForTodoCount(page, "2", 1);

			// Add from Client 2
			await page.click('[data-testid="add-todo-2"]');
			await waitForTodoCount(page, "1", 2);
			await waitForTodoCount(page, "2", 2);

			// Add another from Client 1
			await page.click('[data-testid="add-todo-1"]');
			await waitForTodoCount(page, "1", 3);
			await waitForTodoCount(page, "2", 3);
		});
	});

	test.describe("Update Sync", () => {
		test("should sync toggle completed across clients", async ({ page }) => {
			await page.goto("/collections/proxy-test");
			await page.waitForSelector('[data-testid="client-1"]');

			await waitForTodoCount(page, "1", 0);

			// Add a todo
			await page.click('[data-testid="add-todo-1"]');
			await waitForTodoCount(page, "1", 1);
			await waitForTodoCount(page, "2", 1);

			// Verify initially not completed
			const initialCompleted1 = await isTodoCompleted(page, "1", 0);
			const initialCompleted2 = await isTodoCompleted(page, "2", 0);
			expect(initialCompleted1).toBe(false);
			expect(initialCompleted2).toBe(false);

			// Toggle completed from Client 1
			await page
				.locator('[data-testid="client-1"] ul li')
				.first()
				.locator('input[type="checkbox"]')
				.click();

			// Both should now be completed
			await expect(async () => {
				const completed1 = await isTodoCompleted(page, "1", 0);
				const completed2 = await isTodoCompleted(page, "2", 0);
				expect(completed1).toBe(true);
				expect(completed2).toBe(true);
			}).toPass({ timeout: 5000 });
		});

		test("should sync title edit across clients", async ({ page }) => {
			await page.goto("/collections/proxy-test");
			await page.waitForSelector('[data-testid="client-1"]');

			await waitForTodoCount(page, "1", 0);

			// Add a todo
			await page.click('[data-testid="add-todo-1"]');
			await waitForTodoCount(page, "1", 1);

			// Click to edit the title in Client 1
			await page
				.locator('[data-testid="client-1"] ul li')
				.first()
				.locator('button[title="Click to edit"]')
				.click();

			// Type new title
			const input = page
				.locator('[data-testid="client-1"] ul li')
				.first()
				.locator("input[type='text']");
			await input.fill("Updated Title");
			await input.press("Enter");

			// Both clients should show the updated title
			await expect(async () => {
				const titles1 = await getTodoTitles(page, "1");
				const titles2 = await getTodoTitles(page, "2");
				expect(titles1[0]).toBe("Updated Title");
				expect(titles2[0]).toBe("Updated Title");
			}).toPass({ timeout: 5000 });
		});
	});

	test.describe("Delete Sync", () => {
		test("should sync delete across clients", async ({ page }) => {
			await page.goto("/collections/proxy-test");
			await page.waitForSelector('[data-testid="client-1"]');

			await waitForTodoCount(page, "1", 0);

			// Add 2 todos
			await page.click('[data-testid="add-todo-1"]');
			await waitForTodoCount(page, "1", 1);
			await page.click('[data-testid="add-todo-2"]');
			await waitForTodoCount(page, "1", 2);
			await waitForTodoCount(page, "2", 2);

			// Delete from Client 1 (click the × button)
			await page
				.locator('[data-testid="client-1"] ul li')
				.first()
				.locator("button")
				.last()
				.click();

			// Both should now have 1 todo
			await waitForTodoCount(page, "1", 1);
			await waitForTodoCount(page, "2", 1);
		});
	});

	test.describe("Truncate Sync", () => {
		test("should sync clear all (truncate) across clients", async ({
			page,
		}) => {
			await page.goto("/collections/proxy-test");
			await page.waitForSelector('[data-testid="client-1"]');

			await waitForTodoCount(page, "1", 0);

			// Add several todos
			await page.click('[data-testid="add-todo-1"]');
			await page.click('[data-testid="add-todo-2"]');
			await page.click('[data-testid="add-todo-1"]');
			await waitForTodoCount(page, "1", 3);
			await waitForTodoCount(page, "2", 3);

			// Clear all from Client 2
			await page.click('[data-testid="clear-all-2"]');

			// Both should now have 0 todos
			await waitForTodoCount(page, "1", 0);
			await waitForTodoCount(page, "2", 0);
		});
	});

	test.describe("Client Management", () => {
		test("should add a new client that loads existing data", async ({
			page,
		}) => {
			await page.goto("/collections/proxy-test");
			await page.waitForSelector('[data-testid="client-1"]');

			// Add some todos
			await page.click('[data-testid="add-todo-1"]');
			await page.click('[data-testid="add-todo-2"]');
			await waitForTodoCount(page, "1", 2);

			// Add a new client
			await page.click('[data-testid="add-client"]');
			await page.waitForSelector('[data-testid="client-3"]');

			// New client should have the same 2 todos
			await waitForTodoCount(page, "3", 2);
		});

		test("should sync to newly added client", async ({ page }) => {
			await page.goto("/collections/proxy-test");
			await page.waitForSelector('[data-testid="client-1"]');

			// Add a client first
			await page.click('[data-testid="add-client"]');
			await page.waitForSelector('[data-testid="client-3"]');
			await waitForTodoCount(page, "3", 0);

			// Add todo from Client 1
			await page.click('[data-testid="add-todo-1"]');

			// All 3 clients should have 1 todo
			await waitForTodoCount(page, "1", 1);
			await waitForTodoCount(page, "2", 1);
			await waitForTodoCount(page, "3", 1);
		});
	});

	test.describe("Data Persistence", () => {
		test("should persist data after page refresh", async ({ page }) => {
			await page.goto("/collections/proxy-test");
			await page.waitForSelector('[data-testid="client-1"]');

			// Add some todos
			await page.click('[data-testid="add-todo-1"]');
			await page.click('[data-testid="add-todo-2"]');
			await waitForTodoCount(page, "1", 2);

			// Refresh the page
			await page.reload();
			await page.waitForSelector('[data-testid="client-1"]');

			// Should still have 2 todos
			await waitForTodoCount(page, "1", 2);
			await waitForTodoCount(page, "2", 2);
		});
	});
});
