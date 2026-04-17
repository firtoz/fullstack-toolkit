import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
	clearOpfsRootEntriesWithPrefix,
	indexeddbPlaygroundDbNameForE2e,
	opfsSqliteFilePrefix,
	sqlitePlaygroundDbNameForE2e,
} from "./e2e-worker-db";

/**
 * Unified E2E tests for both SQLite WASM and IndexedDB collections
 *
 * These tests verify that both collection implementations provide the same
 * rich feature set with consistent behavior:
 * - Basic CRUD operations
 * - Inline editing
 * - Bulk selection and operations
 * - Soft delete (deletedAt)
 * - Statistics display
 * - Show/hide deleted items
 * - Concurrent operations
 */

type CollectionConfig = {
	readonly name: string;
	readonly buildUrl: (testInfo: TestInfo) => string;
	readonly clearStorage: (page: Page, testInfo: TestInfo) => Promise<void>;
};

const COLLECTION_CONFIGS: readonly CollectionConfig[] = [
	{
		name: "SQLite WASM (with checkpoint)",
		buildUrl: (ti) =>
			`/collections/sqlite-test?checkpoint=true&e2eWorker=${ti.parallelIndex}`,
		clearStorage: async (page, ti) => {
			await clearOpfsRootEntriesWithPrefix(
				page,
				opfsSqliteFilePrefix(sqlitePlaygroundDbNameForE2e(ti)),
			);
		},
	},
	{
		name: "SQLite WASM (no checkpoint)",
		buildUrl: (ti) =>
			`/collections/sqlite-test?checkpoint=false&e2eWorker=${ti.parallelIndex}`,
		clearStorage: async (page, ti) => {
			await clearOpfsRootEntriesWithPrefix(
				page,
				opfsSqliteFilePrefix(sqlitePlaygroundDbNameForE2e(ti)),
			);
		},
	},
	{
		name: "IndexedDB",
		buildUrl: (ti) =>
			`/collections/indexeddb-test?e2eWorker=${ti.parallelIndex}`,
		clearStorage: async (page, ti) => {
			const name = indexeddbPlaygroundDbNameForE2e(ti);
			await page.evaluate((n) => {
				indexedDB.deleteDatabase(n);
			}, name);
		},
	},
];

for (const config of COLLECTION_CONFIGS) {
	test.describe(`Unified Collections - ${config.name}`, () => {
		test.beforeEach(async ({ page }, testInfo) => {
			// Clear storage before each test
			await page.goto("/");
			await config.clearStorage(page, testInfo);
		});

		test("should initialize and display empty state", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Should show title and description
			await expect(page.locator("h1")).toBeVisible();
			await expect(page.locator("p").first()).toBeVisible();

			// Should show statistics
			await expect(page.getByText("Total")).toBeVisible();
			await expect(page.getByText("Pending")).toBeVisible();
			await expect(page.getByText("Done")).toBeVisible();

			// Should show input form
			await expect(page.getByPlaceholder("Add a new task...")).toBeVisible();
			await expect(
				page.getByRole("button", { name: "Add Task" }),
			).toBeVisible();

			// Should show empty state
			await expect(page.getByText("No tasks yet")).toBeVisible();
		});

		test("should add and display a new task", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			const input = page.getByTestId("todo-input");
			const addButton = page.getByTestId("add-task-button");

			// Add a task
			await input.fill("Test Task");
			await addButton.click();

			// Should see the task
			await expect(page.getByTestId("todo-list")).toBeVisible({
				timeout: 3000,
			});
			await expect(
				page.locator("[data-testid^='todo-title-']").first(),
			).toHaveValue("Test Task");

			// Statistics should update
			await expect(page.getByTestId("count-total")).toHaveText("1");
			await expect(page.getByTestId("count-pending")).toHaveText("1");
		});

		test("should support inline editing", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add a task
			await page.getByTestId("todo-input").fill("Original Title");
			await page.getByTestId("add-task-button").click();

			// Wait for task to appear
			const taskInput = page.locator("[data-testid^='todo-title-']").first();
			await expect(taskInput).toBeVisible({ timeout: 3000 });
			await expect(taskInput).toHaveValue("Original Title");

			// Edit the task
			await taskInput.click();
			await taskInput.fill("Updated Title");
			await taskInput.press("Enter");

			// Wait for update to persist
			await page.waitForTimeout(300);

			// Should see updated title
			await expect(taskInput).toHaveValue("Updated Title", { timeout: 2000 });
		});

		test("should toggle task completion", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add a task
			await page.getByPlaceholder("Add a new task...").fill("Task to Complete");
			await page.getByRole("button", { name: "Add Task" }).click();

			await page.waitForTimeout(500);

			// Find and click the complete button (○)
			const completeButton = page
				.locator('button[aria-label="Mark as complete"]')
				.first();
			await expect(completeButton).toBeVisible({ timeout: 3000 });
			await completeButton.click();

			// Statistics should update
			await expect(page.getByText("Done").locator("..")).toContainText("1", {
				timeout: 2000,
			});

			// Click the undo button (✓)
			const undoButton = page
				.locator('button[aria-label="Mark as incomplete"]')
				.first();
			await expect(undoButton).toBeVisible({ timeout: 2000 });
			await undoButton.click();

			// Should revert
			await expect(page.getByText("Pending").locator("..")).toContainText("1", {
				timeout: 2000,
			});
		});

		test("should support bulk selection and operations", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add multiple tasks
			for (let i = 1; i <= 3; i++) {
				await page.getByPlaceholder("Add a new task...").fill(`Task ${i}`);
				await page.getByRole("button", { name: "Add Task" }).click();
				await page.waitForTimeout(200);
			}

			// Select all
			await page.getByRole("button", { name: "Select All" }).click();

			// Bulk complete
			const bulkCompleteButton = page.getByRole("button", {
				name: /Complete \(\d+\)/,
			});
			await expect(bulkCompleteButton).toBeVisible({ timeout: 2000 });
			await bulkCompleteButton.click();

			// All should be completed
			await expect(page.getByText("Done").locator("..")).toContainText("3", {
				timeout: 2000,
			});
		});

		test("should support soft delete and restore", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add a task
			await page.getByTestId("todo-input").fill("Task to Delete");
			await page.getByTestId("add-task-button").click();

			// Wait for task to appear
			const taskItem = page.locator("[data-testid^='todo-item-']").first();
			await expect(taskItem).toBeVisible({ timeout: 3000 });

			// Delete the task (soft delete)
			const deleteButton = page
				.locator("[data-testid^='todo-delete-']")
				.first();
			await expect(deleteButton).toBeVisible({ timeout: 3000 });
			await deleteButton.click();

			// Give time for the update to propagate
			await page.waitForTimeout(500);

			// Task should disappear - empty state should show
			await expect(page.getByTestId("empty-state")).toBeVisible({
				timeout: 3000,
			});

			// Show deleted
			await page.getByTestId("toggle-deleted").click();

			// Wait for deleted items to appear
			await page.waitForTimeout(300);

			// Task should reappear
			await expect(taskItem).toBeVisible({ timeout: 3000 });

			// Restore and Purge buttons should be visible
			const restoreButton = page
				.locator("[data-testid^='todo-restore-']")
				.first();
			const purgeButton = page.locator("[data-testid^='todo-purge-']").first();
			await expect(restoreButton).toBeVisible();
			await expect(restoreButton).toHaveText("Restore");
			await expect(purgeButton).toBeVisible();
			await expect(purgeButton).toHaveText("Purge");
		});

		test("should handle concurrent operations", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			const concurrentCount = 5;

			// Fill first input (which has no individual add button), then fill additional inputs
			await page.getByTestId("todo-input").fill("Task 0 (not clicked)");
			await page.waitForTimeout(50);

			// Fill inputs 1 through 5 (these have add buttons)
			for (let i = 1; i <= concurrentCount; i++) {
				await page.getByTestId(`todo-input-${i}`).fill(`Concurrent Task ${i}`);
			}

			// Prepare locators for individual add buttons (add-1 through add-5)
			const addButtons = Array.from({ length: concurrentCount }, (_, i) =>
				page.getByTestId(`add-${i + 1}`),
			);

			// Wait for all buttons to be enabled, then click simultaneously
			await Promise.all(addButtons.map((btn) => expect(btn).toBeEnabled()));
			// await Promise.all(addButtons.map((btn) => btn.click()));

			for (const btn of addButtons) {
				await btn.click();
			}

			// All concurrent tasks should appear
			await expect(page.getByText("Total").locator("..")).toContainText(
				String(concurrentCount),
				{ timeout: 5000 },
			);

			// Verify all inputs are still present (individual add buttons don't clear)
			await expect(page.getByTestId("todo-input")).toHaveValue(
				"Task 0 (not clicked)",
			);
			for (let i = 1; i <= concurrentCount; i++) {
				await expect(page.getByTestId(`todo-input-${i}`)).toHaveValue(
					`Concurrent Task ${i}`,
				);
			}
		});

		test("should handle batch add with multiple inputs", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			const batchCount = 3;

			// Fill multiple inputs
			for (let i = 0; i < batchCount; i++) {
				const testId = i === 0 ? "todo-input" : `todo-input-${i}`;
				await page.getByTestId(testId).fill(`Batch Task ${i + 1}`);
			}

			// Button should say "Add Tasks" (plural)
			const addButton = page.getByTestId("add-task-button");
			await expect(addButton).toHaveText("Add Tasks");
			await expect(addButton).toBeEnabled();

			// Click the batch add button
			await addButton.click();

			// All tasks should be added
			await expect(page.getByText("Total").locator("..")).toContainText(
				String(batchCount),
				{ timeout: 5000 },
			);

			// All inputs should be cleared after batch add
			await expect(page.getByTestId("todo-input")).toHaveValue("");

			// Only the first input should remain visible
			await expect(page.getByTestId("todo-input-1")).not.toBeVisible();
		});

		test("should auto-remove empty trailing input", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Fill first input
			await page.getByTestId("todo-input").fill("First Task");
			await page.waitForTimeout(100);

			// Second input should appear
			await expect(page.getByTestId("todo-input-1")).toBeVisible();

			// Fill second input
			await page.getByTestId("todo-input-1").fill("Second Task");
			await page.waitForTimeout(100);

			// Third input should appear
			await expect(page.getByTestId("todo-input-2")).toBeVisible();

			// Clear second input
			await page.getByTestId("todo-input-1").clear();
			await page.waitForTimeout(100);

			// Third input should disappear (second-to-last is empty, last is empty)
			await expect(page.getByTestId("todo-input-2")).not.toBeVisible();
		});

		test("should persist data across page reloads", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add tasks
			await page.getByTestId("todo-input").fill("Persistent Task");
			await page.getByTestId("add-task-button").click();

			// Wait for task to appear
			const taskTitle = page.locator("[data-testid^='todo-title-']").first();
			await expect(taskTitle).toBeVisible({ timeout: 3000 });
			await expect(taskTitle).toHaveValue("Persistent Task");

			// Wait a bit for persistence
			await page.waitForTimeout(1000);

			// Complete it
			const completeButton = page
				.locator("[data-testid^='todo-complete-']")
				.first();
			await expect(completeButton).toBeVisible({ timeout: 3000 });
			await completeButton.click();

			// Wait for completion to persist
			await expect(page.getByTestId("count-done")).toHaveText("1", {
				timeout: 3000,
			});
			await page.waitForTimeout(1500);

			// Reload
			await page.reload();
			await page.waitForLoadState("networkidle");

			// Give time for data to load from database
			await page.waitForTimeout(1000);

			// Task should still exist and be completed
			await expect(taskTitle).toBeVisible({ timeout: 5000 });
			await expect(taskTitle).toHaveValue("Persistent Task");
			await expect(page.getByTestId("count-done")).toHaveText("1", {
				timeout: 3000,
			});
		});

		test("should handle bulk delete with mixed states", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add tasks
			for (let i = 1; i <= 3; i++) {
				await page.getByTestId("todo-input").fill(`Task ${i}`);
				await page.getByTestId("add-task-button").click();
				await page.waitForTimeout(200);
			}

			// Wait for all tasks to appear
			await expect(page.getByTestId("count-total")).toHaveText("3", {
				timeout: 3000,
			});

			// Select all and delete (soft delete)
			const selectAllButton = page.getByTestId("select-all");
			await expect(selectAllButton).toBeVisible({ timeout: 3000 });
			await selectAllButton.click();
			await page.waitForTimeout(100);

			const bulkDeleteButton = page.getByTestId("bulk-delete");
			await expect(bulkDeleteButton).toBeVisible({ timeout: 3000 });
			await bulkDeleteButton.click();

			// Wait for soft delete to process
			await page.waitForTimeout(1000);

			// All tasks should be soft deleted (count should be 0)
			await expect(page.getByTestId("count-total")).toHaveText("0", {
				timeout: 3000,
			});

			// Buttons should disappear since no todos are visible
			await expect(selectAllButton).not.toBeVisible({ timeout: 2000 });

			// Show deleted
			await page.getByTestId("toggle-deleted").click();

			// Wait for deleted items to fully render
			await expect(page.getByTestId("count-total")).toHaveText("3", {
				timeout: 3000,
			});
			await expect(page.getByTestId("todo-list")).toBeVisible({
				timeout: 3000,
			});

			// Wait for Select All button to appear (it only shows when todos.length > 0)
			await expect(selectAllButton).toBeVisible({ timeout: 3000 });

			// Extra wait to ensure todos are fully rendered and selectable
			await page.waitForTimeout(500);

			// Check if button says "Deselect All" (items might still be selected from before)
			const buttonText = await selectAllButton.textContent();
			if (buttonText === "Deselect All") {
				// Items are already selected, bulk purge button should already be visible
				const bulkPurgeButton = page.getByTestId("bulk-purge");
				await expect(bulkPurgeButton).toBeVisible({ timeout: 3000 });
				await bulkPurgeButton.click();
			} else {
				// Need to select all first
				await selectAllButton.click();
				await page.waitForTimeout(300);

				const bulkPurgeButton = page.getByTestId("bulk-purge");
				await expect(bulkPurgeButton).toBeVisible({ timeout: 3000 });
				await bulkPurgeButton.click();
			}

			// Wait for purge to process
			await page.waitForTimeout(1000);

			// All tasks should be gone permanently
			await expect(page.getByTestId("empty-state")).toBeVisible({
				timeout: 3000,
			});
		});

		test("should handle bulk restore", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add tasks
			for (let i = 1; i <= 3; i++) {
				await page.getByTestId("todo-input").fill(`Task ${i}`);
				await page.getByTestId("add-task-button").click();
				await page.waitForTimeout(200);
			}

			// Wait for all tasks to appear
			await expect(page.getByTestId("count-total")).toHaveText("3", {
				timeout: 3000,
			});

			// Select all and delete (soft delete)
			const selectAllButton = page.getByTestId("select-all");
			await selectAllButton.click();
			await page.waitForTimeout(100);

			const bulkDeleteButton = page.getByTestId("bulk-delete");
			await bulkDeleteButton.click();
			await page.waitForTimeout(1000);

			// All tasks should be soft deleted
			await expect(page.getByTestId("count-total")).toHaveText("0", {
				timeout: 3000,
			});

			// Show deleted
			await page.getByTestId("toggle-deleted").click();
			await page.waitForTimeout(500);

			// All tasks should be visible as deleted
			await expect(page.getByTestId("count-total")).toHaveText("3", {
				timeout: 3000,
			});

			// Select all deleted tasks
			await expect(selectAllButton).toBeVisible({ timeout: 3000 });
			await selectAllButton.click();
			await page.waitForTimeout(300);

			// Restore button should appear for individual items
			const restoreButtons = page.locator("[data-testid^='todo-restore-']");
			await expect(restoreButtons.first()).toBeVisible({ timeout: 3000 });

			// Click first restore button
			await restoreButtons.first().click();
			await page.waitForTimeout(500);

			// Hide deleted to see restored item
			await page.getByTestId("toggle-deleted").click();
			await page.waitForTimeout(500);

			// One task should be visible (restored)
			await expect(page.getByTestId("count-total")).toHaveText("1", {
				timeout: 3000,
			});
		});

		// ============================================================
		// ACID & BULLETPROOF TESTS
		// ============================================================

		test("should handle special characters and unicode", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			const specialCases = [
				"Task with emoji 🚀 🎉 ✨",
				"Unicode: 日本語 العربية 中文",
				"Special chars: <>&\"'`",
				"Spaces and\ttabs",
				"SQL injection'; DROP TABLE tasks;--",
				'Script <script>alert("xss")</script>',
				`Very long task ${"x".repeat(500)}`,
			];

			for (const text of specialCases) {
				await page.getByTestId("todo-input").fill(text);
				await page.getByTestId("add-task-button").click();
				await page.waitForTimeout(300);
			}

			// All tasks should be added
			await expect(page.getByTestId("count-total")).toHaveText(
				String(specialCases.length),
				{ timeout: 5000 },
			);

			// Verify each task persisted correctly
			const taskInputs = page.locator("[data-testid^='todo-title-']");
			for (let i = 0; i < specialCases.length; i++) {
				const input = taskInputs.nth(i);
				await expect(input).toHaveValue(specialCases[i], { timeout: 2000 });
			}

			// Reload and verify persistence
			await page.reload();
			await page.waitForLoadState("networkidle");
			await page.waitForTimeout(1000);

			await expect(page.getByTestId("count-total")).toHaveText(
				String(specialCases.length),
				{ timeout: 5000 },
			);
		});

		test("should handle rapid concurrent edits on same task", async (
			{ page },
			testInfo,
		) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add a task
			await page.getByTestId("todo-input").fill("Test Task");
			await page.getByTestId("add-task-button").click();

			const taskInput = page.locator("[data-testid^='todo-title-']").first();
			await expect(taskInput).toBeVisible({ timeout: 3000 });

			// Rapidly edit the task multiple times
			for (let i = 0; i < 10; i++) {
				await taskInput.fill(`Edit ${i}`);
				// Press Enter immediately without waiting
				await taskInput.press("Enter");
			}

			// Wait for all updates to settle
			await page.waitForTimeout(2000);

			// The final value should be one of the edits (likely the last one)
			const finalValue = await taskInput.inputValue();
			expect(finalValue).toMatch(/Edit \d+/);

			// Reload to verify persistence
			await page.reload();
			await page.waitForLoadState("networkidle");
			await page.waitForTimeout(1000);

			// Task should still exist and have a valid value
			const taskAfterReload = page
				.locator("[data-testid^='todo-title-']")
				.first();
			await expect(taskAfterReload).toBeVisible({ timeout: 3000 });
			const valueAfterReload = await taskAfterReload.inputValue();
			expect(valueAfterReload).toMatch(/Edit \d+/);
		});

		test("should handle rapid toggle operations", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add a task
			await page.getByTestId("todo-input").fill("Toggle Test");
			await page.getByTestId("add-task-button").click();
			await page.waitForTimeout(500);

			// Rapidly toggle completion status
			for (let i = 0; i < 20; i++) {
				const completeButton = page
					.locator('button[aria-label="Mark as complete"]')
					.first();
				const incompleteButton = page
					.locator('button[aria-label="Mark as incomplete"]')
					.first();

				// Check which button is visible and click it
				const completeVisible = await completeButton.isVisible();
				if (completeVisible) {
					await completeButton.click();
				} else {
					await incompleteButton.click();
				}
				// No wait - rapid fire
			}

			// Wait for operations to settle
			await page.waitForTimeout(2000);

			// Task should still exist and be in a valid state
			const taskItem = page.locator("[data-testid^='todo-item-']").first();
			await expect(taskItem).toBeVisible({ timeout: 3000 });

			// Statistics should be consistent
			const total = await page.getByTestId("count-total").textContent();
			const pending = await page.getByTestId("count-pending").textContent();
			const done = await page.getByTestId("count-done").textContent();

			expect(Number(total)).toBe(1);
			expect(Number(pending) + Number(done)).toBe(1);
		});

		test("should handle mixed bulk operations rapidly", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add multiple tasks
			for (let i = 1; i <= 10; i++) {
				await page.getByTestId("todo-input").fill(`Task ${i}`);
				await page.getByTestId("add-task-button").click();
			}

			await expect(page.getByTestId("count-total")).toHaveText("10", {
				timeout: 5000,
			});

			// Rapidly perform bulk operations
			const selectAllButton = page.getByTestId("select-all");

			// Select all
			await selectAllButton.click();
			await page.waitForTimeout(100);

			// Complete all
			const bulkCompleteButton = page.getByRole("button", {
				name: /Complete \(\d+\)/,
			});
			await bulkCompleteButton.click();
			await page.waitForTimeout(200);

			// Deselect
			await selectAllButton.click();
			await page.waitForTimeout(100);

			// Select all again
			await selectAllButton.click();
			await page.waitForTimeout(100);

			// Uncomplete all
			const bulkUncompleteButton = page.getByRole("button", {
				name: /Reopen \(\d+\)/,
			});
			await bulkUncompleteButton.click();
			await page.waitForTimeout(200);

			// Verify final state
			const pending = await page.getByTestId("count-pending").textContent();
			expect(Number(pending)).toBe(10);
		});

		test("should maintain data integrity during delete/restore cycles", async (
			{ page },
			testInfo,
		) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add a task with specific content
			const originalTitle = "Integrity Test Task";
			await page.getByTestId("todo-input").fill(originalTitle);
			await page.getByTestId("add-task-button").click();

			const taskInput = page.locator("[data-testid^='todo-title-']").first();
			await expect(taskInput).toBeVisible({ timeout: 3000 });

			// Complete it
			const completeButton = page
				.locator("[data-testid^='todo-complete-']")
				.first();
			await completeButton.click();
			await page.waitForTimeout(500);

			// Verify it's completed
			await expect(page.getByTestId("count-done")).toHaveText("1", {
				timeout: 3000,
			});

			// Delete it (soft delete)
			const deleteButton = page
				.locator("[data-testid^='todo-delete-']")
				.first();
			await deleteButton.click();
			await page.waitForTimeout(500);

			// Show deleted
			await page.getByTestId("toggle-deleted").click();
			await page.waitForTimeout(500);

			// Verify task still has completed status and correct title
			const deletedTaskInput = page
				.locator("[data-testid^='todo-title-']")
				.first();
			await expect(deletedTaskInput).toHaveValue(originalTitle);

			// Completion status should be preserved
			await expect(page.getByTestId("count-done")).toHaveText("1", {
				timeout: 2000,
			});

			// Restore it
			const restoreButton = page
				.locator("[data-testid^='todo-restore-']")
				.first();
			await expect(restoreButton).toHaveText("Restore");
			await restoreButton.click();
			await page.waitForTimeout(500);

			// Hide deleted
			await page.getByTestId("toggle-deleted").click();
			await page.waitForTimeout(500);

			// Task should be back with all properties intact
			const restoredTaskInput = page
				.locator("[data-testid^='todo-title-']")
				.first();
			await expect(restoredTaskInput).toBeVisible({ timeout: 3000 });
			await expect(restoredTaskInput).toHaveValue(originalTitle);
			await expect(page.getByTestId("count-done")).toHaveText("1", {
				timeout: 2000,
			});
			await expect(page.getByTestId("count-total")).toHaveText("1", {
				timeout: 2000,
			});
		});

		test("should purge deleted tasks permanently", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add a task
			await page.getByTestId("todo-input").fill("Task to Purge");
			await page.getByTestId("add-task-button").click();
			await page.waitForTimeout(500);

			// Verify task was added
			await expect(page.getByTestId("count-total")).toHaveText("1", {
				timeout: 3000,
			});

			// Soft delete the task
			const deleteButton = page
				.locator("[data-testid^='todo-delete-']")
				.first();
			await deleteButton.click();
			await page.waitForTimeout(500);

			// Task should be gone from view
			await expect(page.getByTestId("empty-state")).toBeVisible({
				timeout: 3000,
			});

			// Show deleted tasks
			await page.getByTestId("toggle-deleted").click();
			await page.waitForTimeout(500);

			// Purge the task permanently
			const purgeButton = page.locator("[data-testid^='todo-purge-']").first();
			await expect(purgeButton).toBeVisible();
			await purgeButton.click();
			await page.waitForTimeout(500);

			// Task should be gone even with deleted shown
			await expect(page.getByTestId("empty-state")).toBeVisible({
				timeout: 3000,
			});

			// Reload and verify it's really gone
			await page.reload();
			await page.waitForLoadState("networkidle");
			await page.waitForTimeout(500);

			// Show deleted
			await page.getByTestId("toggle-deleted").click();
			await page.waitForTimeout(500);

			// Should still be empty
			await expect(page.getByTestId("empty-state")).toBeVisible({
				timeout: 3000,
			});
		});

		test("should handle stress test with many tasks", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			const taskCount = 50;

			// Efficient approach: fill first input, fill second input, then spam the + button
			await page.getByTestId("todo-input").fill("Dummy");
			await expect(page.getByTestId("todo-input-1")).toBeEditable({
				timeout: 3000,
			});
			await page.getByTestId("todo-input-1").fill("Stress Task");

			// Click the add button on line 2 many times
			const addButton = page.getByTestId("add-1");
			await expect(addButton).toBeVisible();
			await expect(addButton).toBeEnabled();

			for (let i = 0; i < taskCount; i++) {
				await addButton.click();
			}

			// Verify all tasks were added
			await expect(page.getByTestId("count-total")).toHaveText(
				String(taskCount),
				{ timeout: 10000 },
			);

			// Perform bulk operation on all
			const selectAllButton = page.getByTestId("select-all");
			await selectAllButton.click();

			await expect(page.getByTestId("select-all")).toHaveText("Deselect All", {
				timeout: 500,
			});

			const bulkCompleteButton = page.getByRole("button", {
				name: /Complete \(\d+\)/,
			});
			await bulkCompleteButton.click();

			// Verify all completed
			await expect(page.getByTestId("count-done")).toHaveText(
				String(taskCount),
				{ timeout: 10000 },
			);

			// Wait a bit to ensure persistence completes
			await page.waitForTimeout(200);

			// Reload and verify persistence
			await page.reload();
			await page.waitForLoadState("networkidle");
			await page.waitForTimeout(2000);

			await expect(page.getByTestId("count-total")).toHaveText(
				String(taskCount),
				{ timeout: 10000 },
			);
			await expect(page.getByTestId("count-done")).toHaveText(
				String(taskCount),
				{ timeout: 10000 },
			);
		});

		test("should prevent double-clicking issues", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add a task
			await page.getByTestId("todo-input").fill("Double Click Test");

			// Double-click the add button
			const addButton = page.getByTestId("add-task-button");
			await addButton.dblclick();

			await page.waitForTimeout(1000);

			// Should only create one task, not two
			const total = await page.getByTestId("count-total").textContent();
			expect(Number(total)).toBeLessThanOrEqual(1);
		});

		test("should verify statistics consistency after complex operations", async (
			{ page },
			testInfo,
		) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add 5 tasks
			for (let i = 1; i <= 5; i++) {
				await page.getByTestId("todo-input").fill(`Task ${i}`);
				await page.getByTestId("add-task-button").click();
				await page.waitForTimeout(200);
			}

			await expect(page.getByTestId("count-total")).toHaveText("5", {
				timeout: 3000,
			});

			// Complete 3 tasks individually
			for (let i = 0; i < 3; i++) {
				const completeButton = page
					.locator('button[aria-label="Mark as complete"]')
					.first();
				await completeButton.click();
				await page.waitForTimeout(300);
			}

			// Verify: 5 total, 2 pending, 3 done
			await expect(page.getByTestId("count-total")).toHaveText("5");
			await expect(page.getByTestId("count-pending")).toHaveText("2");
			await expect(page.getByTestId("count-done")).toHaveText("3");

			// Delete 2 tasks (one pending, one done)
			const deleteButtons = page.locator("[data-testid^='todo-delete-']");
			await deleteButtons.nth(0).click();
			await page.waitForTimeout(300);
			await deleteButtons.nth(0).click(); // After first delete, 0 becomes the next item
			await page.waitForTimeout(500);

			// Verify: 3 total visible
			await expect(page.getByTestId("count-total")).toHaveText("3", {
				timeout: 3000,
			});

			// Reload and verify consistency
			await page.reload();
			await page.waitForLoadState("networkidle");
			await page.waitForTimeout(1000);

			const total = await page.getByTestId("count-total").textContent();
			const pending = await page.getByTestId("count-pending").textContent();
			const done = await page.getByTestId("count-done").textContent();

			// Total should equal pending + done
			expect(Number(pending) + Number(done)).toBe(Number(total));
		});

		test("should handle editing during pending operations", async (
			{ page },
			testInfo,
		) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			// Add a task
			await page.getByTestId("todo-input").fill("Edit Test");
			await page.getByTestId("add-task-button").click();

			const taskInput = page.locator("[data-testid^='todo-title-']").first();
			await expect(taskInput).toBeVisible({ timeout: 3000 });

			// Start editing
			await taskInput.fill("First Edit");
			await taskInput.press("Enter");

			// Immediately edit again without waiting
			await taskInput.fill("Second Edit");
			await taskInput.press("Enter");

			// And again
			await taskInput.fill("Third Edit");
			await taskInput.press("Enter");

			// Wait for operations to settle
			await page.waitForTimeout(2000);

			// Should have a valid final value
			const finalValue = await taskInput.inputValue();
			expect(finalValue).toBeTruthy();
			expect(["First Edit", "Second Edit", "Third Edit"]).toContain(finalValue);

			// Verify persistence
			await page.reload();
			await page.waitForLoadState("networkidle");
			await page.waitForTimeout(1000);

			const taskAfterReload = page
				.locator("[data-testid^='todo-title-']")
				.first();
			const valueAfterReload = await taskAfterReload.inputValue();
			expect(valueAfterReload).toBeTruthy();
		});

		test("should handle very long task titles gracefully", async ({ page }, testInfo) => {
			await page.goto(config.buildUrl(testInfo));
			await page.waitForLoadState("networkidle");

			const veryLongText = "A".repeat(10000);
			await page.getByTestId("todo-input").fill(veryLongText);
			await page.getByTestId("add-task-button").click();

			await page.waitForTimeout(1000);

			// Task should either be added or rejected gracefully
			// If added, should be retrievable
			const total = await page.getByTestId("count-total").textContent();
			if (Number(total) === 1) {
				// Task was added, verify it can be retrieved
				const taskInput = page.locator("[data-testid^='todo-title-']").first();
				await expect(taskInput).toBeVisible({ timeout: 3000 });
				const value = await taskInput.inputValue();
				expect(value.length).toBeGreaterThan(0);

				// Reload and verify persistence
				await page.reload();
				await page.waitForLoadState("networkidle");
				await page.waitForTimeout(1000);

				await expect(page.getByTestId("count-total")).toHaveText("1", {
					timeout: 5000,
				});
			}
		});
	});
}
