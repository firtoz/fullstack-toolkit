// IndexedDB migrator that executes generated migration functions

import { type IDBCreator, type IDBDatabaseLike, openIndexedDb } from "./utils";

export type IndexedDBMigrationFunction = (db: IDBDatabaseLike) => Promise<void>;

interface MigrationRecord {
	id: number;
	appliedAt: number;
}

const MIGRATIONS_STORE = "__drizzle_migrations";

/**
 * Runs IndexedDB migrations using generated migration functions.
 * Version = total migrations + 1.
 *
 * Works with any IDBCreator implementation, including custom proxies/mocks.
 *
 * Example usage:
 * ```typescript
 * import { migrations } from './drizzle/indexeddb-migrations';
 * import { migrateIndexedDBWithFunctions } from '@firtoz/drizzle-indexeddb';
 *
 * const db = await migrateIndexedDBWithFunctions('my-db', migrations);
 * ```
 */
export async function migrateIndexedDBWithFunctions(
	dbName: string,
	migrations: IndexedDBMigrationFunction[],
	debug: boolean = false,
	dbCreator?: IDBCreator,
): Promise<IDBDatabaseLike> {
	if (debug) {
		console.log(`[IndexedDB] Starting migration for ${dbName}`);
	}

	// Target version = number of migrations + 1
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
		.map((fn, idx) => ({ fn, idx }))
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
			for (const { fn, idx } of pendingMigrations) {
				if (debug) {
					console.log(`[IndexedDB] Running migration ${idx}`);
				}
				fn(upgradeDb);
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
