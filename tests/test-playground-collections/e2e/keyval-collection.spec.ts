import { expect, test, type Page } from "@playwright/test";

const URL = "/collections/keyval-collection-test";
const STORE_KEY_PREFIX = "kv-test:";

async function clearStorage(page: Page) {
	await page.evaluate((prefix) => {
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(prefix)) {
				keysToRemove.push(key);
			}
		}
		for (const key of keysToRemove) {
			localStorage.removeItem(key);
		}
	}, STORE_KEY_PREFIX);
}

test.describe("KeyVal Collection", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await clearStorage(page);
	});

	test("should show ready state and empty list", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});
		await expect(page.getByTestId("empty-state")).toBeVisible();
		await expect(page.getByTestId("count-total")).toContainText("0");
	});

	test("should add a todo", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		await page.getByTestId("todo-input").fill("KeyVal Todo");
		await page.getByTestId("add-button").click();

		await expect(page.getByTestId("todo-list")).toBeVisible({ timeout: 3000 });
		await expect(page.getByTestId("count-total")).toContainText("1");
		await expect(
			page.locator("[data-testid^='todo-title-']").first(),
		).toContainText("KeyVal Todo");
	});

	test("should add multiple todos", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		for (const title of ["First", "Second", "Third"]) {
			await page.getByTestId("todo-input").fill(title);
			await page.getByTestId("add-button").click();
			await page.waitForTimeout(200);
		}

		await expect(page.getByTestId("count-total")).toContainText("3", {
			timeout: 3000,
		});
	});

	test("should toggle todo completion", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		await page.getByTestId("todo-input").fill("Toggle Me");
		await page.getByTestId("add-button").click();

		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});

		const toggleButton = page.locator("[data-testid^='todo-toggle-']").first();
		await expect(toggleButton).toHaveText("○");
		await toggleButton.click();

		await expect(toggleButton).toHaveText("✓", { timeout: 2000 });
		await expect(page.getByTestId("count-done")).toContainText("1");
	});

	test("should delete a todo", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		await page.getByTestId("todo-input").fill("Delete Me");
		await page.getByTestId("add-button").click();

		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});

		const deleteButton = page.locator("[data-testid^='todo-delete-']").first();
		await deleteButton.click();

		await expect(page.getByTestId("empty-state")).toBeVisible({
			timeout: 3000,
		});
		await expect(page.getByTestId("count-total")).toContainText("0");
	});

	test("should truncate all todos", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		for (let i = 1; i <= 3; i++) {
			await page.getByTestId("todo-input").fill(`Todo ${i}`);
			await page.getByTestId("add-button").click();
			await page.waitForTimeout(200);
		}

		await expect(page.getByTestId("count-total")).toContainText("3", {
			timeout: 3000,
		});

		await page.getByTestId("truncate-button").click();

		await expect(page.getByTestId("empty-state")).toBeVisible({
			timeout: 3000,
		});
		await expect(page.getByTestId("count-total")).toContainText("0");
	});

	test("should persist data across page refreshes", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		await page.getByTestId("todo-input").fill("Persistent Todo");
		await page.getByTestId("add-button").click();

		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});

		// Reload the page
		await page.reload();
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Data should still be there (persisted in localStorage)
		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});
		await expect(
			page.locator("[data-testid^='todo-title-']").first(),
		).toContainText("Persistent Todo");
	});

	test("should persist toggle state across refreshes", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		await page.getByTestId("todo-input").fill("Toggle Persist");
		await page.getByTestId("add-button").click();

		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});

		const toggleButton = page.locator("[data-testid^='todo-toggle-']").first();
		await toggleButton.click();
		await expect(toggleButton).toHaveText("✓", { timeout: 2000 });

		// Reload and verify completed state persisted
		await page.reload();
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		await expect(page.getByTestId("count-done")).toContainText("1", {
			timeout: 3000,
		});
		const toggleAfterReload = page
			.locator("[data-testid^='todo-toggle-']")
			.first();
		await expect(toggleAfterReload).toHaveText("✓");
	});

	test("should clear localStorage on truncate", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		await page.getByTestId("todo-input").fill("Truncate Persist");
		await page.getByTestId("add-button").click();

		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});

		await page.getByTestId("truncate-button").click();

		await expect(page.getByTestId("empty-state")).toBeVisible({
			timeout: 3000,
		});

		// After truncate, reload should also show empty
		await page.reload();
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});
		await expect(page.getByTestId("empty-state")).toBeVisible();
		await expect(page.getByTestId("count-total")).toContainText("0");
	});
});
