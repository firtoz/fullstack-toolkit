import { expect, test } from "@playwright/test";
import { href } from "react-router";

/**
 * E2E tests for @firtoz/db-helpers memory collection.
 *
 * Ensures the memory collection behaves correctly (insert, update, delete, truncate)
 * and that data vanishes on page refresh (no persistence).
 */

const URL = href("/collections/memory-collection-test");

test.describe("Memory Collection", () => {
	test("should show in-memory notice and ready state", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("memory-notice")).toContainText(
			"Refresh the page and all data vanishes",
		);
		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});
		await expect(page.getByTestId("empty-state")).toBeVisible();
		await expect(page.getByTestId("count-total")).toContainText("0");
	});

	test("should add and display todos", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		await page.getByTestId("todo-input").fill("First todo");
		await page.getByTestId("add-button").click();

		await expect(page.getByTestId("todo-list")).toBeVisible({ timeout: 3000 });
		await expect(page.getByTestId("count-total")).toContainText("1");
		await expect(
			page.locator("[data-testid^='todo-title-']").first(),
		).toContainText("First todo");

		await page.getByTestId("todo-input").fill("Second todo");
		await page.getByTestId("add-button").click();

		await expect(page.getByTestId("count-total")).toContainText("2");
	});

	test("should toggle todo completion", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		await page.getByTestId("todo-input").fill("Toggle me");
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

		await page.getByTestId("todo-input").fill("To delete");
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
			timeout: 15_000,
		});

		for (let i = 1; i <= 3; i++) {
			await page.getByTestId("todo-input").fill(`Todo ${i}`);
			await page.getByTestId("add-button").click();
			await expect(page.getByTestId("count-total")).toContainText(String(i), {
				timeout: 5000,
			});
		}

		await page.getByTestId("truncate-button").click();

		await expect(page.getByTestId("empty-state")).toBeVisible({
			timeout: 3000,
		});
		await expect(page.getByTestId("count-total")).toContainText("0");
	});

	test("should vanish data on refresh (no persistence)", async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		await page.getByTestId("todo-input").fill("Ephemeral todo");
		await page.getByTestId("add-button").click();

		await expect(page.getByTestId("count-total")).toContainText("1", {
			timeout: 3000,
		});
		await expect(page.getByTestId("todo-list")).toBeVisible();

		await page.reload();
		await page.waitForLoadState("networkidle");

		await expect(page.getByTestId("status")).toContainText("Ready ✓", {
			timeout: 5000,
		});

		// Data must be gone after refresh (memory-only)
		await expect(page.getByTestId("empty-state")).toBeVisible();
		await expect(page.getByTestId("count-total")).toContainText("0");
	});
});
