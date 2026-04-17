import { test, expect } from "@playwright/test";

test.describe("@firtoz/drizzle-indexeddb - Partial IndexedDB Migrations", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/collections/indexeddb-migration-test", {
			waitUntil: "domcontentloaded",
			timeout: 60_000,
		});

		// Clean up any existing test database using the page context
		await page.evaluate(() => {
			return new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase("test-migration-db");
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
				request.onblocked = () => resolve();
			});
		});

		await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
	});

	test("should apply only pending migrations when some are already applied (3 of 5 applied)", async ({
		page,
	}) => {
		// Wait for page to load and check database
		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 20_000,
		});

		// Manually apply first 3 migrations (indices 0, 1, 2)
		await page.evaluate(async () => {
			// Define fake migrations for testing
			const migrations = [
				// Migration 0: Create initial todo and user tables
				async (db: IDBDatabase, _transaction: IDBTransaction) => {
					if (!db.objectStoreNames.contains("todo")) {
						const store = db.createObjectStore("todo", {
							keyPath: "id",
							autoIncrement: false,
						});
						store.createIndex("todo_user_id_index", "user_id", {
							unique: false,
						});
						store.createIndex("todo_parent_id_index", "parent_id", {
							unique: false,
						});
						store.createIndex("todo_completed_index", "completed", {
							unique: false,
						});
						store.createIndex("todo_created_at_index", "createdAt", {
							unique: false,
						});
						store.createIndex("todo_updated_at_index", "updatedAt", {
							unique: false,
						});
						store.createIndex("todo_deleted_at_index", "deletedAt", {
							unique: false,
						});
					}

					if (!db.objectStoreNames.contains("user")) {
						const store = db.createObjectStore("user", {
							keyPath: "id",
							autoIncrement: false,
						});
						store.createIndex("email_index", "email", { unique: false });
					}
				},
				// Migration 1: Add tag table
				async (db: IDBDatabase, _transaction: IDBTransaction) => {
					if (!db.objectStoreNames.contains("tag")) {
						const store = db.createObjectStore("tag", {
							keyPath: "id",
							autoIncrement: false,
						});
						store.createIndex("tag_name_index", "name", { unique: false });
						store.createIndex("tag_user_id_index", "user_id", {
							unique: false,
						});
						store.createIndex("tag_created_at_index", "createdAt", {
							unique: false,
						});
					}

					if (!db.objectStoreNames.contains("todo_tag")) {
						const store = db.createObjectStore("todo_tag", {
							keyPath: ["todo_id", "tag_id"],
							autoIncrement: false,
						});
						store.createIndex("todo_tag_todo_id_index", "todo_id", {
							unique: false,
						});
						store.createIndex("todo_tag_tag_id_index", "tag_id", {
							unique: false,
						});
					}
				},
				// Migration 2: Add comment table
				async (db: IDBDatabase, _transaction: IDBTransaction) => {
					if (!db.objectStoreNames.contains("comment")) {
						const store = db.createObjectStore("comment", {
							keyPath: "id",
							autoIncrement: false,
						});
						store.createIndex("comment_todo_id_index", "todo_id", {
							unique: false,
						});
						store.createIndex("comment_user_id_index", "user_id", {
							unique: false,
						});
						store.createIndex("comment_created_at_index", "createdAt", {
							unique: false,
						});
						store.createIndex("comment_updated_at_index", "updatedAt", {
							unique: false,
						});
						store.createIndex("comment_deleted_at_index", "deletedAt", {
							unique: false,
						});
					}
				},
				// Migration 3: Add project table and project_id index to todos
				async (db: IDBDatabase, _transaction: IDBTransaction) => {
					if (!db.objectStoreNames.contains("project")) {
						const store = db.createObjectStore("project", {
							keyPath: "id",
							autoIncrement: false,
						});
						store.createIndex("project_name_index", "name", { unique: false });
						store.createIndex("project_user_id_index", "user_id", {
							unique: false,
						});
						store.createIndex("project_created_at_index", "createdAt", {
							unique: false,
						});
						store.createIndex("project_updated_at_index", "updatedAt", {
							unique: false,
						});
						store.createIndex("project_archived_index", "archived", {
							unique: false,
						});
					}

					const todoStore = _transaction.objectStore("todo");
					if (!todoStore.indexNames.contains("todo_project_id_index")) {
						todoStore.createIndex("todo_project_id_index", "project_id", {
							unique: false,
						});
					}
				},
				// Migration 4: Add attachment table
				async (db: IDBDatabase, _transaction: IDBTransaction) => {
					if (!db.objectStoreNames.contains("attachment")) {
						const store = db.createObjectStore("attachment", {
							keyPath: "id",
							autoIncrement: false,
						});
						store.createIndex("attachment_todo_id_index", "todo_id", {
							unique: false,
						});
						store.createIndex("attachment_user_id_index", "user_id", {
							unique: false,
						});
						store.createIndex("attachment_file_name_index", "file_name", {
							unique: false,
						});
						store.createIndex("attachment_file_type_index", "file_type", {
							unique: false,
						});
						store.createIndex("attachment_created_at_index", "createdAt", {
							unique: false,
						});
					}
				},
			];

			return new Promise<void>((resolve, reject) => {
				const request = indexedDB.open("test-migration-db", 4); // Version 4 = 3 migrations + 1

				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					request.result.close();
					resolve();
				};

				request.onupgradeneeded = async (event) => {
					const db = (event.target as IDBOpenDBRequest).result;
					const transaction = (event.target as IDBOpenDBRequest).transaction;

					if (!transaction) {
						reject(new Error("No transaction"));
						return;
					}

					try {
						// Create migrations store
						if (!db.objectStoreNames.contains("__drizzle_migrations")) {
							const migrationStore = db.createObjectStore(
								"__drizzle_migrations",
								{
									keyPath: "id",
									autoIncrement: false,
								},
							);
							migrationStore.createIndex("appliedAt", "appliedAt", {
								unique: false,
							});
						}

						// Apply first 3 migrations
						for (let i = 0; i < 3; i++) {
							await migrations[i](db, transaction);

							// Record the migration
							const migrationStore = transaction.objectStore(
								"__drizzle_migrations",
							);
							migrationStore.add({
								id: i,
								appliedAt: Date.now(),
							});
						}
					} catch (error) {
						console.error("Manual migration failed:", error);
						transaction.abort();
						reject(error);
					}
				};
			});
		});

		// Reload the page to check the partial migration status
		await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });

		// Wait for page to check database
		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 20_000,
		});

		// Should show 3 applied, 2 pending
		await expect(page.getByTestId("applied-migrations-count")).toHaveText(
			"3 applied",
		);
		await expect(page.getByTestId("pending-migrations-count")).toHaveText(
			"2 pending",
		);

		// Should show message about pending migrations
		await expect(page.getByTestId("migration-message")).toContainText(
			"3 migrations applied, 2 pending",
		);

		// Check applied migrations list
		await expect(page.getByTestId("applied-migrations-list")).toHaveText(
			"0, 1, 2",
		);

		// Now run the migration to apply the remaining 2
		await page.getByTestId("run-migration-button").click();

		// Wait for migration to complete
		await expect(page.getByTestId("migration-status")).toHaveText("success", {
			timeout: 10000,
		});

		// Should indicate only 2 new migrations were applied
		await expect(page.getByTestId("migration-message")).toContainText(
			"Successfully applied 2 migrations",
		);

		// Now all 5 should be applied
		await expect(page.getByTestId("applied-migrations-count")).toHaveText(
			"5 applied",
		);
		await expect(page.getByTestId("applied-migrations-list")).toHaveText(
			"0, 1, 2, 3, 4",
		);

		// No pending migrations badge should be shown
		await expect(
			page.getByTestId("pending-migrations-count"),
		).not.toBeVisible();
	});

	test("should correctly identify partial migration state after page reload", async ({
		page,
	}) => {
		// Wait for idle status
		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 20_000,
		});

		// Manually apply first migration only (index 0)
		await page.evaluate(async () => {
			// Define fake migrations for testing (same as above)
			const migrations = [
				// Migration 0: Create initial todo and user tables
				async (db: IDBDatabase, _transaction: IDBTransaction) => {
					if (!db.objectStoreNames.contains("todo")) {
						const store = db.createObjectStore("todo", {
							keyPath: "id",
							autoIncrement: false,
						});
						store.createIndex("todo_user_id_index", "user_id", {
							unique: false,
						});
						store.createIndex("todo_parent_id_index", "parent_id", {
							unique: false,
						});
						store.createIndex("todo_completed_index", "completed", {
							unique: false,
						});
						store.createIndex("todo_created_at_index", "createdAt", {
							unique: false,
						});
						store.createIndex("todo_updated_at_index", "updatedAt", {
							unique: false,
						});
						store.createIndex("todo_deleted_at_index", "deletedAt", {
							unique: false,
						});
					}

					if (!db.objectStoreNames.contains("user")) {
						const store = db.createObjectStore("user", {
							keyPath: "id",
							autoIncrement: false,
						});
						store.createIndex("email_index", "email", { unique: false });
					}
				},
				// Migration 1: Add tag table
				async (db: IDBDatabase, _transaction: IDBTransaction) => {
					if (!db.objectStoreNames.contains("tag")) {
						const store = db.createObjectStore("tag", {
							keyPath: "id",
							autoIncrement: false,
						});
						store.createIndex("tag_name_index", "name", { unique: false });
						store.createIndex("tag_user_id_index", "user_id", {
							unique: false,
						});
						store.createIndex("tag_created_at_index", "createdAt", {
							unique: false,
						});
					}

					if (!db.objectStoreNames.contains("todo_tag")) {
						const store = db.createObjectStore("todo_tag", {
							keyPath: ["todo_id", "tag_id"],
							autoIncrement: false,
						});
						store.createIndex("todo_tag_todo_id_index", "todo_id", {
							unique: false,
						});
						store.createIndex("todo_tag_tag_id_index", "tag_id", {
							unique: false,
						});
					}
				},
				// Migration 2: Add comment table
				async (db: IDBDatabase, _transaction: IDBTransaction) => {
					if (!db.objectStoreNames.contains("comment")) {
						const store = db.createObjectStore("comment", {
							keyPath: "id",
							autoIncrement: false,
						});
						store.createIndex("comment_todo_id_index", "todo_id", {
							unique: false,
						});
						store.createIndex("comment_user_id_index", "user_id", {
							unique: false,
						});
						store.createIndex("comment_created_at_index", "createdAt", {
							unique: false,
						});
						store.createIndex("comment_updated_at_index", "updatedAt", {
							unique: false,
						});
						store.createIndex("comment_deleted_at_index", "deletedAt", {
							unique: false,
						});
					}
				},
				// Migration 3: Add project table and project_id index to todos
				async (db: IDBDatabase, _transaction: IDBTransaction) => {
					if (!db.objectStoreNames.contains("project")) {
						const store = db.createObjectStore("project", {
							keyPath: "id",
							autoIncrement: false,
						});
						store.createIndex("project_name_index", "name", { unique: false });
						store.createIndex("project_user_id_index", "user_id", {
							unique: false,
						});
						store.createIndex("project_created_at_index", "createdAt", {
							unique: false,
						});
						store.createIndex("project_updated_at_index", "updatedAt", {
							unique: false,
						});
						store.createIndex("project_archived_index", "archived", {
							unique: false,
						});
					}

					const todoStore = _transaction.objectStore("todo");
					if (!todoStore.indexNames.contains("todo_project_id_index")) {
						todoStore.createIndex("todo_project_id_index", "project_id", {
							unique: false,
						});
					}
				},
				// Migration 4: Add attachment table
				async (db: IDBDatabase, _transaction: IDBTransaction) => {
					if (!db.objectStoreNames.contains("attachment")) {
						const store = db.createObjectStore("attachment", {
							keyPath: "id",
							autoIncrement: false,
						});
						store.createIndex("attachment_todo_id_index", "todo_id", {
							unique: false,
						});
						store.createIndex("attachment_user_id_index", "user_id", {
							unique: false,
						});
						store.createIndex("attachment_file_name_index", "file_name", {
							unique: false,
						});
						store.createIndex("attachment_file_type_index", "file_type", {
							unique: false,
						});
						store.createIndex("attachment_created_at_index", "createdAt", {
							unique: false,
						});
					}
				},
			];

			return new Promise<void>((resolve, reject) => {
				const request = indexedDB.open("test-migration-db", 2); // Version 2 = 1 migration + 1

				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					request.result.close();
					resolve();
				};

				request.onupgradeneeded = async (event) => {
					const db = (event.target as IDBOpenDBRequest).result;
					const transaction = (event.target as IDBOpenDBRequest).transaction;

					if (!transaction) {
						reject(new Error("No transaction"));
						return;
					}

					try {
						const migrationStore = db.createObjectStore(
							"__drizzle_migrations",
							{
								keyPath: "id",
								autoIncrement: false,
							},
						);
						migrationStore.createIndex("appliedAt", "appliedAt", {
							unique: false,
						});

						await migrations[0](db, transaction);

						migrationStore.add({
							id: 0,
							appliedAt: Date.now(),
						});
					} catch (error) {
						transaction.abort();
						reject(error);
					}
				};
			});
		});

		// Reload to check status
		await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });

		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 20_000,
		});

		// Should show 1 applied, 4 pending
		await expect(page.getByTestId("applied-migrations-count")).toHaveText(
			"1 applied",
		);
		await expect(page.getByTestId("pending-migrations-count")).toHaveText(
			"4 pending",
		);
		await expect(page.getByTestId("applied-migrations-list")).toHaveText("0");
	});

	test("should handle database with only 1 migration total", async ({
		page,
	}) => {
		// Wait for idle status
		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 20_000,
		});

		// Manually apply the single migration
		await page.evaluate(async () => {
			// Define a single migration for testing
			const singleMigration = async (
				db: IDBDatabase,
				_transaction: IDBTransaction,
			) => {
				if (!db.objectStoreNames.contains("todo")) {
					const store = db.createObjectStore("todo", {
						keyPath: "id",
						autoIncrement: false,
					});
					store.createIndex("todo_user_id_index", "user_id", {
						unique: false,
					});
					store.createIndex("todo_completed_index", "completed", {
						unique: false,
					});
				}

				if (!db.objectStoreNames.contains("user")) {
					const store = db.createObjectStore("user", {
						keyPath: "id",
						autoIncrement: false,
					});
					store.createIndex("email_index", "email", { unique: false });
				}
			};

			return new Promise<void>((resolve, reject) => {
				const request = indexedDB.open("test-migration-db", 2); // Version 2 = 1 migration + 1

				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					request.result.close();
					resolve();
				};

				request.onupgradeneeded = async (event) => {
					const db = (event.target as IDBOpenDBRequest).result;
					const transaction = (event.target as IDBOpenDBRequest).transaction;

					if (!transaction) {
						reject(new Error("No transaction"));
						return;
					}

					try {
						const migrationStore = db.createObjectStore(
							"__drizzle_migrations",
							{
								keyPath: "id",
								autoIncrement: false,
							},
						);
						migrationStore.createIndex("appliedAt", "appliedAt", {
							unique: false,
						});

						await singleMigration(db, transaction);

						migrationStore.add({
							id: 0,
							appliedAt: Date.now(),
						});
					} catch (error) {
						transaction.abort();
						reject(error);
					}
				};
			});
		});

		// Reload to check status
		await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });

		await expect(page.getByTestId("migration-status")).toHaveText("idle", {
			timeout: 20_000,
		});

		// Should show 1 applied, 4 pending (because test page has 5 migrations)
		await expect(page.getByTestId("applied-migrations-count")).toHaveText(
			"1 applied",
		);
		await expect(page.getByTestId("pending-migrations-count")).toHaveText(
			"4 pending",
		);
		await expect(page.getByTestId("applied-migrations-list")).toHaveText("0");

		// Verify the tables were created correctly
		const dbInfo = await page.evaluate(() => {
			return new Promise<{ stores: string[]; version: number }>(
				(resolve, reject) => {
					const request = indexedDB.open("test-migration-db");
					request.onsuccess = () => {
						const db = request.result;
						const stores = Array.from(db.objectStoreNames);
						const version = db.version;
						db.close();
						resolve({ stores, version });
					};
					request.onerror = () => reject(request.error);
				},
			);
		});

		expect(dbInfo.version).toBe(2);
		expect(dbInfo.stores).toContain("todo");
		expect(dbInfo.stores).toContain("user");
		expect(dbInfo.stores).toContain("__drizzle_migrations");
	});
});
