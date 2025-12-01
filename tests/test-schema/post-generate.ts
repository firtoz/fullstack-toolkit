#!/usr/bin/env bun
/**
 * Post-generation script to generate IndexedDB migrations
 * This runs after `drizzle-kit generate` to create executable migration files
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
	JournalEntry,
	Journal,
	Snapshot,
	TableDefinition,
	ColumnDefinition,
	IndexDefinition,
} from "@firtoz/drizzle-utils";

const META_DIR = "./drizzle/meta";
const JOURNAL_PATH = join(META_DIR, "_journal.json");
const OUTPUT_DIR = "./drizzle/indexeddb-migrations";
const SNAPSHOTS_PATH = "./drizzle/snapshots.ts";

function generateMigrationCode(
	entry: JournalEntry,
	snapshot: Snapshot,
	prevSnapshot: Snapshot | null,
): string {
	const lines: string[] = [];
	const tableName = entry.tag.replace(/^\d+_/, "").replace(/_/g, " ");

	// Determine if db is used
	const currentTables: Record<string, TableDefinition> = snapshot.tables || {};
	const previousTables: Record<string, TableDefinition> =
		prevSnapshot?.tables || {};

	let needsDb = false;

	// Check for new tables (needs db)
	for (const tableName of Object.keys(currentTables)) {
		if (!previousTables[tableName]) {
			needsDb = true;
		}
	}

	// Check for deleted tables (needs db)
	for (const tableName of Object.keys(previousTables)) {
		if (!currentTables[tableName]) {
			needsDb = true;
		}
	}

	// Check for index changes (needs db)
	for (const [tableName, tableDef] of Object.entries(currentTables)) {
		if (previousTables[tableName]) {
			const newIndexes = tableDef.indexes || {};
			const oldIndexes = previousTables[tableName].indexes || {};
			const hasIndexChanges =
				Object.keys(newIndexes).length !== Object.keys(oldIndexes).length ||
				Object.keys(newIndexes).some((name) => !oldIndexes[name]);
			if (hasIndexChanges) {
				needsDb = true;
				break;
			}
		}
	}

	const dbParam = needsDb ? "db: IDBDatabaseLike" : "_db: IDBDatabaseLike";

	lines.push(
		`import type { IDBDatabaseLike } from "@firtoz/drizzle-indexeddb";`,
		``,
		`/**`,
		` * Migration: ${tableName}`,
		` * Generated from: ${entry.tag}`,
		` */`,
		`export async function migrate_${entry.idx.toString().padStart(4, "0")}(`,
		`\t${dbParam},`,
		`): Promise<void> {`,
	);

	// Find new tables
	for (const [tableName, tableDef] of Object.entries(currentTables)) {
		if (!previousTables[tableName]) {
			lines.push(`\t// Create new table: ${tableName}`);
			lines.push(`\tif (!db.hasStore("${tableName}")) {`);

			// Find primary key
			const pkColumn = Object.values(
				tableDef.columns as Record<string, ColumnDefinition>,
			).find((col) => col.primaryKey);

			if (pkColumn) {
				lines.push(
					`\t\tdb.createStore("${tableName}", {`,
					`\t\t\tkeyPath: "${pkColumn.name}",`,
					`\t\t\tautoIncrement: ${pkColumn.autoincrement},`,
					`\t\t});`,
				);
			} else {
				lines.push(
					`\t\tdb.createStore("${tableName}", {`,
					`\t\t\tautoIncrement: true,`,
					`\t\t});`,
				);
			}

			// Create indexes
			for (const [indexName, indexDef] of Object.entries(tableDef.indexes)) {
				const keyPath =
					indexDef.columns.length === 1
						? `"${indexDef.columns[0]}"`
						: `[${indexDef.columns.map((c) => `"${c}"`).join(", ")}]`;

				lines.push(
					`\t\tdb.createIndex("${tableName}", "${indexName}", ${keyPath}, { unique: ${indexDef.isUnique} });`,
				);
			}

			lines.push(`\t}`);
			lines.push("");
		} else {
			// Table exists, check for index changes
			const prevTableDef: TableDefinition = previousTables[tableName];
			const newIndexes: Record<string, IndexDefinition> =
				tableDef.indexes || {};
			const oldIndexes: Record<string, IndexDefinition> =
				prevTableDef.indexes || {};

			const hasIndexChanges =
				Object.keys(newIndexes).length !== Object.keys(oldIndexes).length ||
				Object.keys(newIndexes).some((name) => !oldIndexes[name]);

			if (hasIndexChanges) {
				lines.push(`\t// Update indexes for table: ${tableName}`);
				lines.push(`\tif (db.hasStore("${tableName}")) {`);

				// Add new indexes
				for (const [indexName, indexDef] of Object.entries(newIndexes)) {
					if (!oldIndexes[indexName]) {
						const keyPath =
							indexDef.columns.length === 1
								? `"${indexDef.columns[0]}"`
								: `[${indexDef.columns.map((c) => `"${c}"`).join(", ")}]`;

						lines.push(
							`\t\tdb.createIndex("${tableName}", "${indexName}", ${keyPath}, { unique: ${indexDef.isUnique} });`,
						);
					}
				}

				lines.push(`\t}`);
				lines.push("");
			}
		}
	}

	// Find deleted tables
	for (const tableName of Object.keys(previousTables)) {
		if (!currentTables[tableName]) {
			lines.push(
				`\t// Delete table: ${tableName}`,
				`\tif (db.hasStore("${tableName}")) {`,
				`\t\tdb.deleteStore("${tableName}");`,
				`\t}`,
				"",
			);
		}
	}

	// If no changes detected, add a comment
	// (10 lines = import, blank, doc comment x4, function header x2, closing brace)
	if (lines.length === 10) {
		lines.push(`\t// No IndexedDB schema changes needed for this migration`);
	}

	lines.push(`}`);

	return lines.join("\n");
}

try {
	const startTime = performance.now();
	console.log(`[post-generate] Starting migration generation...`);

	// Read the journal

	const journalContent = readFileSync(JOURNAL_PATH, "utf-8");
	const journal: Journal = JSON.parse(journalContent);

	console.log(`[post-generate] Found ${journal.entries.length} migrations`);

	// Create output directory
	if (!existsSync(OUTPUT_DIR)) {
		mkdirSync(OUTPUT_DIR, { recursive: true });
		console.log(`[post-generate] Created output directory: ${OUTPUT_DIR}`);
	}

	// Generate imports for snapshots.ts
	const snapshotImports: string[] = [
		"import journal from './meta/_journal.json';",
	];
	const snapshotKeys: string[] = [];
	const migrationImports: string[] = [];
	const migrationNames: string[] = [];

	// Load all snapshots and generate migrations
	const snapshots: Snapshot[] = [];

	for (const entry of journal.entries) {
		const snapshotKey = `m${entry.idx.toString().padStart(4, "0")}`;
		const fileName = `${entry.idx.toString().padStart(4, "0")}_snapshot.json`;
		const snapshotPath = join(META_DIR, fileName);

		// Load snapshot

		const snapshotContent = readFileSync(snapshotPath, "utf-8");
		const snapshot: Snapshot = JSON.parse(snapshotContent);
		snapshots.push(snapshot);

		// Add to snapshots.ts imports
		snapshotImports.push(`import ${snapshotKey} from './meta/${fileName}';`);
		snapshotKeys.push(snapshotKey);

		// Generate migration file

		const prevSnapshot = entry.idx > 0 ? snapshots[entry.idx - 1] : null;
		const migrationCode = generateMigrationCode(entry, snapshot, prevSnapshot);

		const migrationFileName = `${entry.tag}.ts`;
		const migrationPath = join(OUTPUT_DIR, migrationFileName);
		writeFileSync(migrationPath, migrationCode, "utf-8");

		// Add to index imports
		const migrationName = `migrate_${entry.idx.toString().padStart(4, "0")}`;
		migrationImports.push(`import { ${migrationName} } from './${entry.tag}';`);
		migrationNames.push(migrationName);
	}

	// Generate index.ts for migrations
	const indexContent = `import type { IDBDatabaseLike } from "@firtoz/drizzle-indexeddb";

${migrationImports.join("\n")}

export type IndexedDBMigrationFunction = (
\tdb: IDBDatabaseLike,
) => Promise<void>;

export const migrations: IndexedDBMigrationFunction[] = [
\t${migrationNames.join(",\n\t")}
];

export default migrations;
`;

	writeFileSync(join(OUTPUT_DIR, "index.ts"), indexContent, "utf-8");
	console.log(`[post-generate] ✓ Generated ${join(OUTPUT_DIR, "index.ts")}`);

	// Generate snapshots.ts
	const snapshotsContent = `${snapshotImports.join("\n")}
import type { IndexedDBMigrationConfig } from '@firtoz/drizzle-indexeddb';

export default {
\tjournal,
\tsnapshots: {
\t\t${snapshotKeys.join(",\n\t\t")}
\t}
} as IndexedDBMigrationConfig;
`;

	writeFileSync(SNAPSHOTS_PATH, snapshotsContent, "utf-8");
	console.log(`[post-generate] ✓ Generated ${SNAPSHOTS_PATH}`);

	const endTime = performance.now();
	const totalTime = endTime - startTime;

	console.log(`[post-generate] Migrations: ${migrationNames.join(", ")}`);
	console.log(
		`[post-generate] ✓ Complete! Generated ${journal.entries.length} migrations in ${totalTime.toFixed(2)}ms`,
	);
	console.log(
		`[post-generate] Average time per migration: ${(totalTime / journal.entries.length).toFixed(2)}ms`,
	);
} catch (error) {
	console.error("[post-generate] Error:", error);
	process.exit(1);
}
