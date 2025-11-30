import { useState, useEffect } from "react";
import { migrateIndexedDBWithFunctions } from "@firtoz/drizzle-indexeddb";
import type { IndexedDBMigrationFunction } from "test-schema/drizzle/indexeddb-migrations";
import { openIndexedDb } from "@firtoz/drizzle-indexeddb/utils";

// Fake migrations for testing purposes (5 migrations total)
const testMigrations: IndexedDBMigrationFunction[] = [
	// Migration 0: Create initial todo and user tables
	async (db: IDBDatabase) => {
		if (!db.objectStoreNames.contains("todo")) {
			const store = db.createObjectStore("todo", {
				keyPath: "id",
				autoIncrement: false,
			});
			store.createIndex("todo_user_id_index", "user_id", { unique: false });
			store.createIndex("todo_parent_id_index", "parent_id", { unique: false });
			store.createIndex("todo_completed_index", "completed", { unique: false });
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
	async (db: IDBDatabase) => {
		if (!db.objectStoreNames.contains("tag")) {
			const store = db.createObjectStore("tag", {
				keyPath: "id",
				autoIncrement: false,
			});
			store.createIndex("tag_name_index", "name", { unique: false });
			store.createIndex("tag_user_id_index", "user_id", { unique: false });
			store.createIndex("tag_created_at_index", "createdAt", { unique: false });
		}

		if (!db.objectStoreNames.contains("todo_tag")) {
			const store = db.createObjectStore("todo_tag", {
				keyPath: ["todo_id", "tag_id"],
				autoIncrement: false,
			});
			store.createIndex("todo_tag_todo_id_index", "todo_id", { unique: false });
			store.createIndex("todo_tag_tag_id_index", "tag_id", { unique: false });
		}
	},
	// Migration 2: Add comment table
	async (db: IDBDatabase) => {
		if (!db.objectStoreNames.contains("comment")) {
			const store = db.createObjectStore("comment", {
				keyPath: "id",
				autoIncrement: false,
			});
			store.createIndex("comment_todo_id_index", "todo_id", { unique: false });
			store.createIndex("comment_user_id_index", "user_id", { unique: false });
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
	async (db: IDBDatabase) => {
		if (!db.objectStoreNames.contains("project")) {
			const store = db.createObjectStore("project", {
				keyPath: "id",
				autoIncrement: false,
			});
			store.createIndex("project_name_index", "name", { unique: false });
			store.createIndex("project_user_id_index", "user_id", { unique: false });
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

		const todoStore = db.transaction("todo").objectStore("todo");
		if (!todoStore.indexNames.contains("todo_project_id_index")) {
			todoStore.createIndex("todo_project_id_index", "project_id", {
				unique: false,
			});
		}
	},
	// Migration 4: Add attachment table
	async (db: IDBDatabase) => {
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

const migrations = testMigrations;

interface MigrationStatus {
	status: "idle" | "checking" | "migrating" | "success" | "error";
	message?: string;
	dbInfo?: {
		version: number;
		objectStores: string[];
		indexes: Record<string, string[]>;
		appliedMigrations: number[];
		pendingMigrations: number;
	};
}

export function meta() {
	return [
		{ title: "IndexedDB Migration Test" },
		{
			name: "description",
			content: "Test IndexedDB migrations with generated migration functions",
		},
	];
}

function IndexedDBMigrationContent() {
	const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
		status: "checking",
		message: "Checking database status...",
	});

	const checkDatabaseStatus = async () => {
		try {
			// Try to open the database to check its status
			const existingDb = await openIndexedDb("test-migration-db");

			if (!existingDb) {
				setMigrationStatus({
					status: "idle",
					message: "Database not found. Ready to create.",
				});
				return;
			}

			// Check if database is empty (no object stores means newly created)
			if (existingDb.objectStoreNames.length === 0) {
				existingDb.close();
				// Delete the empty database that was just created
				await new Promise<void>((resolve, reject) => {
					const deleteRequest = indexedDB.deleteDatabase("test-migration-db");
					deleteRequest.onsuccess = () => resolve();
					deleteRequest.onerror = () => reject(deleteRequest.error);
				});
				setMigrationStatus({
					status: "idle",
					message: "Database not found. Ready to create.",
				});
				return;
			}

			// Check applied migrations
			const appliedMigrations: number[] = [];
			if (existingDb.objectStoreNames.contains("__drizzle_migrations")) {
				const transaction = existingDb.transaction(
					"__drizzle_migrations",
					"readonly",
				);
				const store = transaction.objectStore("__drizzle_migrations");
				const request = store.getAll();

				await new Promise<void>((resolve, reject) => {
					request.onsuccess = () => {
						const records = request.result as Array<{ id: number }>;
						appliedMigrations.push(...records.map((r) => r.id));
						resolve();
					};
					request.onerror = () => reject(request.error);
				});
			}

			// Gather database info
			const objectStores = Array.from(existingDb.objectStoreNames);
			const indexes: Record<string, string[]> = {};

			if (objectStores.length > 0) {
				const transaction = existingDb.transaction(objectStores, "readonly");
				for (const storeName of objectStores) {
					const store = transaction.objectStore(storeName);
					indexes[storeName] = Array.from(store.indexNames);
				}
			}

			const pendingCount = migrations.length - appliedMigrations.length;

			setMigrationStatus({
				status: "idle",
				message:
					pendingCount > 0
						? `${appliedMigrations.length} migrations applied, ${pendingCount} pending`
						: `All ${appliedMigrations.length} migrations applied`,
				dbInfo: {
					version: existingDb.version,
					objectStores,
					indexes,
					appliedMigrations: appliedMigrations.sort((a, b) => a - b),
					pendingMigrations: pendingCount,
				},
			});

			existingDb.close();
		} catch (error) {
			setMigrationStatus({
				status: "error",
				message: `Failed to check database: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	};

	useEffect(() => {
		checkDatabaseStatus();

		// Expose migrations on window for test purposes
		if (typeof window !== "undefined") {
			(
				window as unknown as { testMigrations?: typeof migrations }
			).testMigrations = migrations;
		}
	}, []);

	const runMigration = async () => {
		setMigrationStatus({
			status: "migrating",
			message: "Running migrations...",
		});

		try {
			const startTime = Date.now();

			const db = await migrateIndexedDBWithFunctions(
				"test-migration-db",
				migrations,
				true, // debug mode
			);

			const endTime = Date.now();

			// Check applied migrations
			const appliedMigrations: number[] = [];
			const migrationsTransaction = db.transaction(
				"__drizzle_migrations",
				"readonly",
			);
			const migrationsStore = migrationsTransaction.objectStore(
				"__drizzle_migrations",
			);
			const migrationsRequest = migrationsStore.getAll();

			await new Promise<void>((resolve, reject) => {
				migrationsRequest.onsuccess = () => {
					const records = migrationsRequest.result as Array<{ id: number }>;
					appliedMigrations.push(...records.map((r) => r.id));
					resolve();
				};
				migrationsRequest.onerror = () => reject(migrationsRequest.error);
			});

			// Gather database info
			const objectStores = Array.from(db.objectStoreNames);
			const indexes: Record<string, string[]> = {};

			// Read indexes for each object store
			const transaction = db.transaction(objectStores, "readonly");
			for (const storeName of objectStores) {
				const store = transaction.objectStore(storeName);
				indexes[storeName] = Array.from(store.indexNames);
			}

			const migrationsApplied =
				appliedMigrations.length -
				(migrationStatus.dbInfo?.appliedMigrations.length ?? 0);

			setMigrationStatus({
				status: "success",
				message:
					migrationsApplied > 0
						? `Successfully applied ${migrationsApplied} migration${migrationsApplied !== 1 ? "s" : ""} in ${endTime - startTime}ms!`
						: `No new migrations to apply. Database is up to date.`,
				dbInfo: {
					version: db.version,
					objectStores,
					indexes,
					appliedMigrations: appliedMigrations.sort((a, b) => a - b),
					pendingMigrations: 0,
				},
			});

			db.close();
		} catch (error) {
			setMigrationStatus({
				status: "error",
				message: `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	};

	const deleteMigration = async () => {
		try {
			await new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase("test-migration-db");
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
			setMigrationStatus({
				status: "idle",
				message: "Database deleted. Ready to create.",
			});
		} catch (error) {
			setMigrationStatus({
				status: "error",
				message: `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	};

	return (
		<div>
			<div>
				<div>
					<h1>IndexedDB Migration Test</h1>
					<p>Testing generated IndexedDB migration functions</p>
				</div>

				<div>
					{/* Migration Info */}
					<div>
						<h2>Migration Status</h2>
						<div>
							<span data-testid="migration-status">
								{migrationStatus.status}
							</span>
							<span data-testid="total-migrations">
								{migrations.length} total migrations
							</span>
							{migrationStatus.dbInfo && (
								<>
									<span data-testid="applied-migrations-count">
										{migrationStatus.dbInfo.appliedMigrations.length} applied
									</span>
									{migrationStatus.dbInfo.pendingMigrations > 0 && (
										<span data-testid="pending-migrations-count">
											{migrationStatus.dbInfo.pendingMigrations} pending
										</span>
									)}
								</>
							)}
						</div>
						{migrationStatus.message && (
							<p data-testid="migration-message">{migrationStatus.message}</p>
						)}
					</div>

					{/* Database Info */}
					{migrationStatus.dbInfo && (
						<div>
							<h3>Database Information</h3>
							<div data-testid="db-info">
								<div>
									<span>Version: </span>
									<span data-testid="db-version">
										{migrationStatus.dbInfo.version}
									</span>
								</div>
								<div>
									<span>Applied Migrations: </span>
									<span data-testid="applied-migrations-list">
										{migrationStatus.dbInfo.appliedMigrations.length > 0
											? migrationStatus.dbInfo.appliedMigrations.join(", ")
											: "None"}
									</span>
								</div>
								<div>
									<span>Object Stores: </span>
									<ul>
										{migrationStatus.dbInfo.objectStores.map((storeName) => {
											const indexCount =
												migrationStatus.dbInfo?.indexes[storeName]?.length ?? 0;
											return (
												<li
													key={storeName}
													data-testid={`object-store-${storeName}`}
												>
													<span>{storeName}</span>
													{indexCount > 0 && (
														<span>({indexCount} indexes)</span>
													)}
												</li>
											);
										})}
									</ul>
								</div>
								{Object.entries(migrationStatus.dbInfo.indexes).map(
									([storeName, storeIndexes]) =>
										storeIndexes.length > 0 && (
											<div key={storeName}>
												<span>Indexes on {storeName}: </span>
												<ul>
													{storeIndexes.map((indexName) => (
														<li key={indexName}>• {indexName}</li>
													))}
												</ul>
											</div>
										),
								)}
							</div>
						</div>
					)}

					{/* Actions */}
					<div>
						<button
							type="button"
							onClick={runMigration}
							disabled={
								migrationStatus.status === "migrating" ||
								migrationStatus.status === "checking"
							}
							data-testid="run-migration-button"
						>
							{migrationStatus.status === "migrating"
								? "Migrating..."
								: migrationStatus.status === "checking"
									? "Checking..."
									: migrationStatus.dbInfo?.pendingMigrations === 0
										? "Re-run Migration"
										: "Run Migration"}
						</button>
						<button
							type="button"
							onClick={deleteMigration}
							disabled={
								migrationStatus.status === "migrating" ||
								migrationStatus.status === "checking"
							}
							data-testid="delete-db-button"
						>
							Delete Database
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function IndexedDBMigrationTest() {
	return <IndexedDBMigrationContent />;
}
