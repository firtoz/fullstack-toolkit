import { useState, useEffect } from "react";
import {
	migrateIndexedDBWithFunctions,
	type IDBDatabaseLike,
	type IndexedDBMigrationFunction,
} from "@firtoz/drizzle-indexeddb";
import { openIndexedDb } from "@firtoz/drizzle-indexeddb/utils";

// Fake migrations for testing purposes (5 migrations total)
const testMigrations: IndexedDBMigrationFunction[] = [
	// Migration 0: Create initial todo and user tables
	async (db: IDBDatabaseLike) => {
		if (!db.hasStore("todo")) {
			db.createStore("todo", { keyPath: "id", autoIncrement: false });
			db.createIndex("todo", "todo_user_id_index", "user_id", {
				unique: false,
			});
			db.createIndex("todo", "todo_parent_id_index", "parent_id", {
				unique: false,
			});
			db.createIndex("todo", "todo_completed_index", "completed", {
				unique: false,
			});
			db.createIndex("todo", "todo_created_at_index", "createdAt", {
				unique: false,
			});
			db.createIndex("todo", "todo_updated_at_index", "updatedAt", {
				unique: false,
			});
			db.createIndex("todo", "todo_deleted_at_index", "deletedAt", {
				unique: false,
			});
		}

		if (!db.hasStore("user")) {
			db.createStore("user", { keyPath: "id", autoIncrement: false });
			db.createIndex("user", "email_index", "email", { unique: false });
		}
	},
	// Migration 1: Add tag table
	async (db: IDBDatabaseLike) => {
		if (!db.hasStore("tag")) {
			db.createStore("tag", { keyPath: "id", autoIncrement: false });
			db.createIndex("tag", "tag_name_index", "name", { unique: false });
			db.createIndex("tag", "tag_user_id_index", "user_id", { unique: false });
			db.createIndex("tag", "tag_created_at_index", "createdAt", {
				unique: false,
			});
		}

		if (!db.hasStore("todo_tag")) {
			db.createStore("todo_tag", { keyPath: "todo_id", autoIncrement: false });
			db.createIndex("todo_tag", "todo_tag_todo_id_index", "todo_id", {
				unique: false,
			});
			db.createIndex("todo_tag", "todo_tag_tag_id_index", "tag_id", {
				unique: false,
			});
		}
	},
	// Migration 2: Add comment table
	async (db: IDBDatabaseLike) => {
		if (!db.hasStore("comment")) {
			db.createStore("comment", { keyPath: "id", autoIncrement: false });
			db.createIndex("comment", "comment_todo_id_index", "todo_id", {
				unique: false,
			});
			db.createIndex("comment", "comment_user_id_index", "user_id", {
				unique: false,
			});
			db.createIndex("comment", "comment_created_at_index", "createdAt", {
				unique: false,
			});
			db.createIndex("comment", "comment_updated_at_index", "updatedAt", {
				unique: false,
			});
			db.createIndex("comment", "comment_deleted_at_index", "deletedAt", {
				unique: false,
			});
		}
	},
	// Migration 3: Add project table and project_id index to todos
	async (db: IDBDatabaseLike) => {
		if (!db.hasStore("project")) {
			db.createStore("project", { keyPath: "id", autoIncrement: false });
			db.createIndex("project", "project_name_index", "name", {
				unique: false,
			});
			db.createIndex("project", "project_user_id_index", "user_id", {
				unique: false,
			});
			db.createIndex("project", "project_created_at_index", "createdAt", {
				unique: false,
			});
			db.createIndex("project", "project_updated_at_index", "updatedAt", {
				unique: false,
			});
			db.createIndex("project", "project_archived_index", "archived", {
				unique: false,
			});
		}

		// Add index to existing todo store
		if (db.hasStore("todo")) {
			db.createIndex("todo", "todo_project_id_index", "project_id", {
				unique: false,
			});
		}
	},
	// Migration 4: Add attachment table
	async (db: IDBDatabaseLike) => {
		if (!db.hasStore("attachment")) {
			db.createStore("attachment", { keyPath: "id", autoIncrement: false });
			db.createIndex("attachment", "attachment_todo_id_index", "todo_id", {
				unique: false,
			});
			db.createIndex("attachment", "attachment_user_id_index", "user_id", {
				unique: false,
			});
			db.createIndex("attachment", "attachment_file_name_index", "file_name", {
				unique: false,
			});
			db.createIndex("attachment", "attachment_file_type_index", "file_type", {
				unique: false,
			});
			db.createIndex("attachment", "attachment_created_at_index", "createdAt", {
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
			const storeNames = existingDb.getStoreNames();
			if (storeNames.length === 0) {
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
			let appliedMigrations: number[] = [];
			if (existingDb.hasStore("__drizzle_migrations")) {
				const records = await existingDb.getAll<{ id: number }>(
					"__drizzle_migrations",
				);
				appliedMigrations = records.map((r) => r.id);
			}

			// Gather database info
			const objectStores = storeNames;
			const indexes: Record<string, string[]> = {};

			for (const storeName of objectStores) {
				const storeIndexes = existingDb.getStoreIndexes(storeName);
				indexes[storeName] = storeIndexes.map((idx) => idx.name);
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
			const migrationRecords = await db.getAll<{ id: number }>(
				"__drizzle_migrations",
			);
			const appliedMigrations = migrationRecords.map((r) => r.id);

			// Gather database info
			const objectStores = db.getStoreNames();
			const indexes: Record<string, string[]> = {};

			// Read indexes for each object store
			for (const storeName of objectStores) {
				const storeIndexes = db.getStoreIndexes(storeName);
				indexes[storeName] = storeIndexes.map((idx) => idx.name);
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
