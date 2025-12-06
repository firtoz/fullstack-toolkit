#!/usr/bin/env node
/**
 * CLI tool to generate IndexedDB migrations from Drizzle schema snapshots
 * Run after `drizzle-kit generate` to create executable migration files
 *
 * Usage:
 *   bun drizzle-indexeddb-generate
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineCommand, runMain } from "citty";
import type {
	JournalEntry,
	Journal,
	Snapshot,
	TableDefinition,
	ColumnDefinition,
	IndexDefinition,
} from "@firtoz/drizzle-utils";
import type { Migration, MigrationOperation } from "../function-migrator";

interface GenerateOptions {
	drizzleDir?: string;
	outputDir?: string;
}

function generateMigration(
	_entry: JournalEntry,
	snapshot: Snapshot,
	prevSnapshot: Snapshot | null,
): Migration {
	const operations: MigrationOperation[] = [];

	const currentTables: Record<string, TableDefinition> = snapshot.tables || {};
	const previousTables: Record<string, TableDefinition> =
		prevSnapshot?.tables || {};

	// Find new tables
	for (const [tableName, tableDef] of Object.entries(currentTables)) {
		if (!previousTables[tableName]) {
			// Find primary key
			const pkColumn = Object.values(
				tableDef.columns as Record<string, ColumnDefinition>,
			).find((col) => col.primaryKey);

			const indexes: Array<{
				name: string;
				keyPath: string | string[];
				unique?: boolean;
			}> = [];

			// Collect indexes
			for (const [indexName, indexDef] of Object.entries(
				tableDef.indexes || {},
			)) {
				indexes.push({
					name: indexName,
					keyPath:
						indexDef.columns.length === 1
							? indexDef.columns[0]
							: indexDef.columns,
					unique: indexDef.isUnique,
				});
			}

			operations.push({
				type: "createTable",
				name: tableName,
				keyPath: pkColumn?.name,
				autoIncrement: pkColumn?.autoincrement ?? false,
				indexes: indexes.length > 0 ? indexes : undefined,
			});
		} else {
			// Table exists, check for index changes
			const prevTableDef: TableDefinition = previousTables[tableName];
			const newIndexes: Record<string, IndexDefinition> =
				tableDef.indexes || {};
			const oldIndexes: Record<string, IndexDefinition> =
				prevTableDef.indexes || {};

			// Add new indexes
			for (const [indexName, indexDef] of Object.entries(newIndexes)) {
				if (!oldIndexes[indexName]) {
					operations.push({
						type: "createIndex",
						tableName,
						indexName,
						keyPath:
							indexDef.columns.length === 1
								? indexDef.columns[0]
								: indexDef.columns,
						unique: indexDef.isUnique,
					});
				}
			}

			// Delete removed indexes
			for (const indexName of Object.keys(oldIndexes)) {
				if (!newIndexes[indexName]) {
					operations.push({
						type: "deleteIndex",
						tableName,
						indexName,
					});
				}
			}
		}
	}

	// Find deleted tables
	for (const tableName of Object.keys(previousTables)) {
		if (!currentTables[tableName]) {
			operations.push({
				type: "deleteTable",
				name: tableName,
			});
		}
	}

	return operations;
}

function migrationToCode(
	migration: Migration,
	idx: number,
	tag: string,
): string {
	const migrationName = tag.replace(/^\d+_/, "").replace(/_/g, " ");
	const lines: string[] = [];

	lines.push(
		`import type { Migration } from "@firtoz/drizzle-indexeddb";`,
		``,
		`/**`,
		` * Migration: ${migrationName}`,
		` * Generated from: ${tag}`,
		` */`,
		`export const migrate_${idx.toString().padStart(4, "0")}: Migration = ${JSON.stringify(migration, null, "\t")};`,
	);

	return lines.join("\n");
}

export function generateIndexedDBMigrations(
	options: GenerateOptions = {},
): void {
	const cwd = process.cwd();
	const drizzleDir = resolve(cwd, options.drizzleDir || "./drizzle");
	const metaDir = join(drizzleDir, "meta");
	const journalPath = join(metaDir, "_journal.json");
	const outputDir = resolve(
		cwd,
		options.outputDir || join(drizzleDir, "indexeddb-migrations"),
	);

	const startTime = performance.now();
	console.log(`[drizzle-indexeddb] Starting migration generation...`);

	// Read the journal
	if (!existsSync(journalPath)) {
		console.error(
			`[drizzle-indexeddb] Error: Journal not found at ${journalPath}`,
		);
		console.error(
			`[drizzle-indexeddb] Make sure to run 'drizzle-kit generate' first`,
		);
		process.exit(1);
	}

	const journalContent = readFileSync(journalPath, "utf-8");
	const journal: Journal = JSON.parse(journalContent);

	console.log(`[drizzle-indexeddb] Found ${journal.entries.length} migrations`);

	// Create output directory
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
		console.log(`[drizzle-indexeddb] Created output directory: ${outputDir}`);
	}

	const migrationImports: string[] = [];
	const migrationNames: string[] = [];

	// Load all snapshots and generate migrations
	const snapshots: Snapshot[] = [];

	for (const entry of journal.entries) {
		const fileName = `${entry.idx.toString().padStart(4, "0")}_snapshot.json`;
		const snapshotPath = join(metaDir, fileName);

		// Load snapshot
		if (!existsSync(snapshotPath)) {
			console.error(
				`[drizzle-indexeddb] Error: Snapshot not found at ${snapshotPath}`,
			);
			process.exit(1);
		}

		const snapshotContent = readFileSync(snapshotPath, "utf-8");
		const snapshot: Snapshot = JSON.parse(snapshotContent);
		snapshots.push(snapshot);

		// Generate migration
		const prevSnapshot = entry.idx > 0 ? snapshots[entry.idx - 1] : null;
		const migration = generateMigration(entry, snapshot, prevSnapshot);
		const migrationCode = migrationToCode(migration, entry.idx, entry.tag);

		const migrationFileName = `${entry.tag}.ts`;
		const migrationPath = join(outputDir, migrationFileName);
		writeFileSync(migrationPath, migrationCode, "utf-8");

		// Add to index imports
		const migrationName = `migrate_${entry.idx.toString().padStart(4, "0")}`;
		migrationImports.push(`import { ${migrationName} } from './${entry.tag}';`);
		migrationNames.push(migrationName);
	}

	// Generate index.ts for migrations
	const indexContent = `import type { Migration } from "@firtoz/drizzle-indexeddb";

${migrationImports.join("\n")}

export const migrations: Migration[] = [
\t${migrationNames.join(",\n\t")}
];

export default migrations;
`;

	writeFileSync(join(outputDir, "index.ts"), indexContent, "utf-8");
	console.log(`[drizzle-indexeddb] ✓ Generated ${join(outputDir, "index.ts")}`);

	const endTime = performance.now();
	const totalTime = endTime - startTime;

	console.log(`[drizzle-indexeddb] Migrations: ${migrationNames.join(", ")}`);
	console.log(
		`[drizzle-indexeddb] ✓ Complete! Generated ${journal.entries.length} migrations in ${totalTime.toFixed(2)}ms`,
	);
}

// CLI entry point
const main = defineCommand({
	meta: {
		name: "drizzle-indexeddb-generate",
		description: "Generate IndexedDB migrations from Drizzle schema",
	},
	args: {
		drizzleDir: {
			type: "string",
			alias: "d",
			default: "./drizzle",
			description: "Path to Drizzle directory",
		},
		outputDir: {
			type: "string",
			alias: "o",
			description:
				"Path to output directory (default: <drizzle-dir>/indexeddb-migrations)",
		},
	},
	run({ args }) {
		generateIndexedDBMigrations({
			drizzleDir: args.drizzleDir,
			outputDir: args.outputDir,
		});
	},
});

// Only run CLI when executed directly (not when imported)
if (import.meta.main) {
	runMain(main);
}
