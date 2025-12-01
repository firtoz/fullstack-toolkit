import { test, expect } from "@playwright/test";

test.describe("@firtoz/drizzle-indexeddb - IndexedDB Migrations", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/collections/indexeddb-migration-test");

		// Wait for page to load
		await page.waitForLoadState("networkidle");

		// Clean up any existing test database using the page context
		await page.evaluate(() => {
			return new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase("test-migration-db");
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
				request.onblocked = () => resolve(); // Still resolve if blocked
			});
		});

		// Reload to reset state
		await page.reload();
	});

	test("should load the IndexedDB migration test page with no database", async ({
		page,
	}) => {
		await expect(
			page.getByRole("heading", { name: "IndexedDB Migration Test" }),
		).toBeVisible();

		// Should show idle status after checking
		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 5000,
		});

		// Should indicate database not found
		await expect(page.getByTestId("migration-message")).toContainText(
			"Database not found",
		);

		// Should show total migrations available
		await expect(page.getByTestId("total-migrations")).toContainText(
			"5 total migrations",
		);
	});

	test("should successfully run migrations from scratch (0 migrations applied)", async ({
		page,
	}) => {
		// Wait for idle status
		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 5000,
		});

		const runButton = page.getByTestId("run-migration-button");
		await expect(runButton).toBeEnabled();

		// Click the run migration button
		await runButton.click();

		// Wait for migration to complete
		await expect(page.getByTestId("migration-status")).toHaveText("success", {
			timeout: 10000,
		});

		// Check that all 5 migrations were applied
		await expect(page.getByTestId("migration-message")).toContainText(
			"Successfully applied 5 migrations",
		);

		// Verify database info is displayed
		await expect(page.getByTestId("db-info")).toBeVisible();
		await expect(page.getByTestId("applied-migrations-count")).toHaveText(
			"5 applied",
		);
		await expect(page.getByTestId("applied-migrations-list")).toHaveText(
			"0, 1, 2, 3, 4",
		);

		// Check that the expected tables were created
		await expect(page.getByTestId("object-store-todo")).toBeVisible();
		await expect(page.getByTestId("object-store-user")).toBeVisible();
	});

	test("should create correct indexes", async ({ page }) => {
		// Run migration
		await page.getByTestId("run-migration-button").click();
		await expect(page.getByTestId("migration-status")).toHaveText("success", {
			timeout: 10000,
		});

		// Check for indexes
		await expect(page.getByText(/Indexes on todo:/i)).toBeVisible();
		await expect(page.getByText("todo_user_id_index")).toBeVisible();
		await expect(page.getByText("todo_completed_index")).toBeVisible();
		await expect(page.getByText("todo_created_at_index")).toBeVisible();

		await expect(page.getByText(/Indexes on user:/i)).toBeVisible();
		await expect(page.getByText("email_index")).toBeVisible();
	});

	test("should handle re-running migrations idempotently (all migrations already applied)", async ({
		page,
	}) => {
		// Wait for idle status
		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 5000,
		});

		// Run migration first time
		await page.getByTestId("run-migration-button").click();
		await expect(page.getByTestId("migration-status")).toHaveText("success", {
			timeout: 10000,
		});

		// Verify all migrations were applied
		await expect(page.getByTestId("applied-migrations-count")).toHaveText(
			"5 applied",
		);
		await expect(page.getByTestId("migration-message")).toContainText(
			"Successfully applied 5 migrations",
		);

		// Reload the page to check database status
		await page.reload();

		// Wait for page to check database
		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 5000,
		});

		// Should show all migrations are applied
		await expect(page.getByTestId("applied-migrations-count")).toHaveText(
			"5 applied",
		);
		await expect(page.getByTestId("migration-message")).toContainText(
			"All 5 migrations applied",
		);

		// No pending migrations should be shown
		await expect(
			page.getByTestId("pending-migrations-count"),
		).not.toBeVisible();

		// Run migration second time (should be idempotent - no new migrations)
		await page.getByTestId("run-migration-button").click();
		await expect(page.getByTestId("migration-status")).toHaveText("success", {
			timeout: 10000,
		});

		// Should indicate no new migrations were applied
		await expect(page.getByTestId("migration-message")).toContainText(
			"No new migrations to apply",
		);
		await expect(page.getByTestId("migration-message")).toContainText(
			"Database is up to date",
		);

		// Still 5 applied, 0 pending
		await expect(page.getByTestId("applied-migrations-count")).toHaveText(
			"5 applied",
		);
	});

	test("should delete database successfully", async ({ page }) => {
		// Run migration first
		await page.getByTestId("run-migration-button").click();
		await expect(page.getByTestId("migration-status")).toHaveText("success", {
			timeout: 10000,
		});

		// Delete the database
		await page.getByTestId("delete-db-button").click();

		// Should reset to idle state
		await expect(page.getByTestId("migration-status")).toHaveText("idle");
		await expect(page.getByTestId("migration-message")).toContainText(
			"Database deleted",
		);

		// DB info should be hidden
		await expect(page.getByTestId("db-info")).not.toBeVisible();
	});

	test("should verify database structure using IndexedDB API", async ({
		page,
	}) => {
		// Run migration
		await page.getByTestId("run-migration-button").click();
		await expect(page.getByTestId("migration-status")).toHaveText("success", {
			timeout: 10000,
		});

		// Verify database structure using IndexedDB API
		const dbStructure = await page.evaluate(async () => {
			return new Promise<{
				version: number;
				objectStores: string[];
				storeDetails: Record<
					string,
					{
						keyPath: string | string[];
						autoIncrement: boolean;
						indexes: string[];
					}
				>;
			}>((resolve, reject) => {
				const request = indexedDB.open("test-migration-db");
				request.onsuccess = () => {
					const db = request.result;
					const objectStores = Array.from(db.objectStoreNames);
					const storeDetails: Record<
						string,
						{
							keyPath: string | string[];
							autoIncrement: boolean;
							indexes: string[];
						}
					> = {};

					const transaction = db.transaction(objectStores, "readonly");
					for (const storeName of objectStores) {
						const store = transaction.objectStore(storeName);
						storeDetails[storeName] = {
							keyPath: store.keyPath as string | string[],
							autoIncrement: store.autoIncrement,
							indexes: Array.from(store.indexNames),
						};
					}

					db.close();
					resolve({
						version: db.version,
						objectStores,
						storeDetails,
					});
				};
				request.onerror = () => reject(request.error);
			});
		});

		// Verify structure (version is implementation detail, just check it's > 0)
		expect(dbStructure.version).toBeGreaterThan(0);
		expect(dbStructure.objectStores).toContain("todo");
		expect(dbStructure.objectStores).toContain("user");
		expect(dbStructure.objectStores).toContain("__drizzle_migrations");

		// Verify todo store
		expect(dbStructure.storeDetails.todo.keyPath).toBe("id");
		expect(dbStructure.storeDetails.todo.autoIncrement).toBe(false);
		expect(dbStructure.storeDetails.todo.indexes.length).toBeGreaterThan(0);
		expect(dbStructure.storeDetails.todo.indexes).toContain(
			"todo_user_id_index",
		);

		// Verify user store
		expect(dbStructure.storeDetails.user.keyPath).toBe("id");
		expect(dbStructure.storeDetails.user.autoIncrement).toBe(false);
		expect(dbStructure.storeDetails.user.indexes).toContain("email_index");
	});
});
