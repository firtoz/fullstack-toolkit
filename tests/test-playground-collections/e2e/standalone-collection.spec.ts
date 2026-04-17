import { expect, test, type Page } from "@playwright/test";

/**
 * E2E tests for the standalone IndexedDB collection API
 *
 * Tests the createStandaloneCollection utility for use outside of React context.
 */

const URL = "/collections/standalone-test";
const DB_NAME = "standalone-test.db";

// Helper to clear IndexedDB
async function clearIndexedDB(page: Page) {
	await page.evaluate((dbName) => {
		indexedDB.deleteDatabase(dbName);
	}, DB_NAME);
}

test.describe("Standalone Collection", () => {
	test.beforeEach(async ({ page }) => {
		// Clear storage before each test
		await page.goto("/");
		await clearIndexedDB(page);
	});

	test("should initialize and show ready state", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		// Should show status as ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Should show empty state initially
		await expect(page.getByTestId("empty-state")).toBeVisible();
		await expect(page.getByTestId("count-total")).toContainText("0");
	});

	test("should add a todo via insert()", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		// Wait for ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Add a todo
		await page.getByTestId("todo-input").fill("Test Todo");
		await page.getByTestId("add-button").click();

		// Should see the todo
		await expect(page.getByTestId("todo-list")).toBeVisible({ timeout: 3000 });
		await expect(page.getByTestId("count-total")).toContainText("1");

		// Check logs for insert
		await expect(page.getByTestId("logs")).toContainText("Insert complete");
	});

	test("should toggle todo completion via update()", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		// Wait for ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Add a todo
		await page.getByTestId("todo-input").fill("Toggle Test");
		await page.getByTestId("add-button").click();

		// Wait for todo to appear
		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});

		// Find the toggle button and click it
		const toggleButton = page.locator("[data-testid^='todo-toggle-']").first();
		await expect(toggleButton).toHaveText("○");
		await toggleButton.click();

		// Should be completed
		await expect(toggleButton).toHaveText("✓", { timeout: 2000 });
		await expect(page.getByTestId("count-done")).toContainText("1");
		await expect(page.getByTestId("logs")).toContainText("Toggle complete");

		// Toggle back
		await toggleButton.click();
		await expect(toggleButton).toHaveText("○", { timeout: 2000 });
		await expect(page.getByTestId("count-pending")).toContainText("1");
	});

	test("should delete a todo via delete()", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		// Wait for ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Add a todo
		await page.getByTestId("todo-input").fill("Delete Test");
		await page.getByTestId("add-button").click();

		// Wait for todo to appear
		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});

		// Delete it
		const deleteButton = page.locator("[data-testid^='todo-delete-']").first();
		await deleteButton.click();

		// Should be gone
		await expect(page.getByTestId("empty-state")).toBeVisible({
			timeout: 3000,
		});
		await expect(page.getByTestId("count-total")).toContainText("0");
		await expect(page.getByTestId("logs")).toContainText("Delete complete");
	});

	test("should truncate all todos via truncate()", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		// Wait for ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Add multiple todos
		for (let i = 1; i <= 3; i++) {
			await page.getByTestId("todo-input").fill(`Todo ${i}`);
			await page.getByTestId("add-button").click();
			await page.waitForTimeout(200);
		}

		// Verify todos were added
		await expect(page.getByTestId("count-total")).toContainText("3", {
			timeout: 3000,
		});

		// Truncate all
		await page.getByTestId("truncate-button").click();

		// Should be empty
		await expect(page.getByTestId("empty-state")).toBeVisible({
			timeout: 3000,
		});
		await expect(page.getByTestId("count-total")).toContainText("0");
		await expect(page.getByTestId("logs")).toContainText("Truncate complete");
	});

	test("should persist data across page reloads", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		// Wait for ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Add a todo
		await page.getByTestId("todo-input").fill("Persistent Todo");
		await page.getByTestId("add-button").click();

		// Wait for todo to appear and persist
		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});
		await page.waitForTimeout(500);

		// Toggle completion
		const toggleButton = page.locator("[data-testid^='todo-toggle-']").first();
		await toggleButton.click();
		await expect(toggleButton).toHaveText("✓", { timeout: 2000 });
		await page.waitForTimeout(500);

		// Reload
		await page.reload();
		await page.waitForLoadState("networkidle");

		// Wait for ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Data should persist
		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});
		await expect(page.getByTestId("count-done")).toContainText("1");

		// Check the title persisted
		const todoTitle = page.locator("[data-testid^='todo-title-']").first();
		await expect(todoTitle).toHaveText("Persistent Todo");
	});

	test("should handle getAll() returning current state", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		// Wait for ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Add multiple todos
		for (let i = 1; i <= 5; i++) {
			await page.getByTestId("todo-input").fill(`Todo ${i}`);
			await page.getByTestId("add-button").click();
			await page.waitForTimeout(100);
		}

		// Wait for all to be added
		await expect(page.getByTestId("count-total")).toContainText("5", {
			timeout: 5000,
		});

		// Click refresh to call getAll() again
		await page.getByTestId("refresh-button").click();

		// Logs should show refresh with 5 todos
		await expect(page.getByTestId("logs")).toContainText("Refreshed: 5 todos");
	});

	test("should handle multiple sequential operations", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		// Wait for ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Add multiple todos sequentially, waiting for each to complete
		const count = 5;
		for (let i = 1; i <= count; i++) {
			// Wait for input to be clear and button enabled
			await page.waitForTimeout(100);
			await page.getByTestId("todo-input").fill(`Todo ${i}`);
			await page.getByTestId("add-button").click();
			// Wait for the todo to appear before adding next
			await expect(page.getByTestId("count-total")).toContainText(String(i), {
				timeout: 5000,
			});
		}

		// All should be present
		await expect(page.getByTestId("count-total")).toContainText(String(count));
	});

	test("should handle special characters", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		// Wait for ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		const specialText = "Todo with emoji 🚀 and <script>alert('xss')</script>";
		await page.getByTestId("todo-input").fill(specialText);
		await page.getByTestId("add-button").click();

		// Should be added
		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});

		// Title should be preserved exactly
		const todoTitle = page.locator("[data-testid^='todo-title-']").first();
		await expect(todoTitle).toHaveText(specialText);

		// Reload and verify persistence
		await page.reload();
		await page.waitForLoadState("networkidle");
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});
		const todoTitleAfterReload = page
			.locator("[data-testid^='todo-title-']")
			.first();
		await expect(todoTitleAfterReload).toHaveText(specialText);
	});

	test("should show logs for all operations", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		// Wait for ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Should show initialization logs
		await expect(page.getByTestId("logs")).toContainText(
			"Creating standalone collection",
		);
		await expect(page.getByTestId("logs")).toContainText(
			"Collection is ready!",
		);

		// Add a todo
		await page.getByTestId("todo-input").fill("Log Test");
		await page.getByTestId("add-button").click();
		await expect(page.getByTestId("logs")).toContainText(
			'Inserting todo: "Log Test"',
		);

		// Clear logs
		await page.getByTestId("clear-logs-button").click();
		await expect(page.getByTestId("logs")).toHaveText("No logs yet...");
	});

	test("should handle reset database", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		// Wait for ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Add a todo
		await page.getByTestId("todo-input").fill("Reset Test");
		await page.getByTestId("add-button").click();
		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});

		// Reset database
		await page.getByTestId("reset-db-button").click();

		// Should show not ready
		await expect(page.getByTestId("logs")).toContainText("Database deleted");

		// Reload to reinitialize
		await page.reload();
		await page.waitForLoadState("networkidle");

		// Wait for ready
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Should be empty after reset
		await expect(page.getByTestId("empty-state")).toBeVisible();
		await expect(page.getByTestId("count-total")).toContainText("0");
	});
});
