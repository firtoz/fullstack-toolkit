// IndexedDB migrator with declarative migration format

import { type IDBCreator, type IDBDatabaseLike, openIndexedDb } from "./utils";

// ============================================================================
// Declarative Migration Types
// ============================================================================

export interface CreateTableOperation {
	type: "createTable";
	name: string;
	keyPath?: string;
	autoIncrement?: boolean;
	indexes?: Array<{
		name: string;
		keyPath: string | string[];
		unique?: boolean;
	}>;
}

export interface DeleteTableOperation {
	type: "deleteTable";
	name: string;
}

export interface CreateIndexOperation {
	type: "createIndex";
	tableName: string;
	indexName: string;
	keyPath: string | string[];
	unique?: boolean;
}

export interface DeleteIndexOperation {
	type: "deleteIndex";
	tableName: string;
	indexName: string;
}

export type MigrationOperation =
	| CreateTableOperation
	| DeleteTableOperation
	| CreateIndexOperation
	| DeleteIndexOperation;

/** A migration is an array of operations to perform */
export type Migration = MigrationOperation[];

// ============================================================================
// Migration Record
// ============================================================================

interface MigrationRecord {
	id: number;
	appliedAt: number;
}

const MIGRATIONS_STORE = "__drizzle_migrations";

// ============================================================================
// Migration Executor
// ============================================================================

/**
 * Executes a single migration operation on the database.
 */
function executeMigrationOperation(
	db: IDBDatabaseLike,
	op: MigrationOperation,
): void {
	switch (op.type) {
		case "createTable": {
			if (!db.hasStore(op.name)) {
				db.createStore(op.name, {
					keyPath: op.keyPath,
					autoIncrement: op.autoIncrement,
				});
				// Create indexes if specified
				if (op.indexes) {
					for (const idx of op.indexes) {
						db.createIndex(op.name, idx.name, idx.keyPath, {
							unique: idx.unique,
						});
					}
				}
			}
			break;
		}
		case "deleteTable": {
			if (db.hasStore(op.name)) {
				db.deleteStore(op.name);
			}
			break;
		}
		case "createIndex": {
			if (db.hasStore(op.tableName)) {
				db.createIndex(op.tableName, op.indexName, op.keyPath, {
					unique: op.unique,
				});
			}
			break;
		}
		case "deleteIndex": {
			if (db.hasStore(op.tableName)) {
				db.deleteIndex(op.tableName, op.indexName);
			}
			break;
		}
	}
}

/**
 * Executes a full migration (array of operations).
 */
function executeMigration(db: IDBDatabaseLike, migration: Migration): void {
	for (const op of migration) {
		executeMigrationOperation(db, op);
	}
}

// ============================================================================
// Main Migrator
// ============================================================================

/**
 * Runs IndexedDB migrations using declarative migration arrays.
 * Version = total migrations + 1.
 *
 * Example usage:
 * ```typescript
 * const migrations: Migration[] = [
 *   [
 *     { type: "createTable", name: "todo", keyPath: "id", indexes: [
 *       { name: "todo_user_id", keyPath: "user_id" }
 *     ]}
 *   ],
 *   [
 *     { type: "createTable", name: "user", keyPath: "id" }
 *   ]
 * ];
 *
 * const db = await migrateIndexedDBWithFunctions('my-db', migrations);
 * ```
 */
export async function migrateIndexedDBWithFunctions(
	dbName: string,
	migrations: Migration[],
	debug: boolean = false,
	dbCreator?: IDBCreator,
): Promise<IDBDatabaseLike> {
	if (debug) {
		console.log(`[IndexedDB] Starting migration for ${dbName}`);
	}

	const targetVersion = migrations.length + 1;

	// Open database to check current state
	let db = await openIndexedDb(dbName, dbCreator);
	const currentVersion = db.version;

	if (debug) {
		console.log(
			`[IndexedDB] Current version: ${currentVersion}, Target: ${targetVersion}`,
		);
	}

	// If already at target version, check if all migrations are recorded
	if (currentVersion >= targetVersion) {
		const applied = await getAppliedMigrations(db);
		if (applied.length === migrations.length) {
			if (debug) {
				console.log("[IndexedDB] Already up to date");
			}
			return db;
		}
	}

	// Get applied migrations before closing
	const appliedMigrations = await getAppliedMigrations(db);
	const appliedSet = new Set(appliedMigrations.map((m) => m.id));

	// Find pending migrations
	const pendingMigrations = migrations
		.map((migration, idx) => ({ migration, idx }))
		.filter(({ idx }) => !appliedSet.has(idx));

	if (pendingMigrations.length === 0) {
		if (debug) {
			console.log("[IndexedDB] No pending migrations");
		}
		return db;
	}

	if (debug) {
		console.log(
			`[IndexedDB] ${pendingMigrations.length} pending migrations to apply`,
		);
	}

	// Close to allow version upgrade
	db.close();

	// Open with target version, running migrations during upgrade
	await openIndexedDb(dbName, dbCreator, {
		version: targetVersion,
		onUpgrade: (upgradeDb) => {
			// Ensure migrations store exists
			if (!upgradeDb.hasStore(MIGRATIONS_STORE)) {
				upgradeDb.createStore(MIGRATIONS_STORE, {
					keyPath: "id",
					autoIncrement: false,
				});
				if (debug) {
					console.log("[IndexedDB] Created migrations store");
				}
			}

			// Run pending migrations
			for (const { migration, idx } of pendingMigrations) {
				if (debug) {
					console.log(`[IndexedDB] Running migration ${idx}`);
				}
				executeMigration(upgradeDb, migration);
			}
		},
	});

	// Reopen normally and record applied migrations
	db = await openIndexedDb(dbName, dbCreator);

	for (const { idx } of pendingMigrations) {
		await db.add(MIGRATIONS_STORE, [{ id: idx, appliedAt: Date.now() }]);
	}

	if (debug) {
		console.log(
			`[IndexedDB] Applied ${pendingMigrations.length} migrations, now at version ${targetVersion}`,
		);
	}

	return db;
}

/**
 * Gets applied migrations from the database.
 */
async function getAppliedMigrations(
	db: IDBDatabaseLike,
): Promise<MigrationRecord[]> {
	if (!db.hasStore(MIGRATIONS_STORE)) {
		return [];
	}
	return db.getAll<MigrationRecord>(MIGRATIONS_STORE);
}
