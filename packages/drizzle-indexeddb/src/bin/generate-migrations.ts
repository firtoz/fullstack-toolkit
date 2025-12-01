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
import type {
	JournalEntry,
	Journal,
	Snapshot,
	TableDefinition,
	ColumnDefinition,
	IndexDefinition,
} from "@firtoz/drizzle-utils";

interface GenerateOptions {
	drizzleDir?: string;
	outputDir?: string;
}

function generateMigrationCode(
	entry: JournalEntry,
	snapshot: Snapshot,
	prevSnapshot: Snapshot | null,
): string {
	const lines: string[] = [];
	const migrationName = entry.tag.replace(/^\d+_/, "").replace(/_/g, " ");

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
		` * Migration: ${migrationName}`,
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

				// Add new indexes (note: deleteIndex not supported in simplified API yet)
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

		// Generate migration file
		const prevSnapshot = entry.idx > 0 ? snapshots[entry.idx - 1] : null;
		const migrationCode = generateMigrationCode(entry, snapshot, prevSnapshot);

		const migrationFileName = `${entry.tag}.ts`;
		const migrationPath = join(outputDir, migrationFileName);
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
function main(): void {
	const args = process.argv.slice(2);
	const command = args[0];

	if (command === "generate" || command === undefined) {
		// Parse options
		const options: GenerateOptions = {};

		for (let i = 1; i < args.length; i++) {
			const arg = args[i];
			if (arg === "--drizzle-dir" && args[i + 1]) {
				options.drizzleDir = args[++i];
			} else if (arg === "--output-dir" && args[i + 1]) {
				options.outputDir = args[++i];
			}
		}

		generateIndexedDBMigrations(options);
	} else if (command === "--help" || command === "-h") {
		console.log(`
drizzle-indexeddb-generate - Generate IndexedDB migrations from Drizzle schema

Usage:
  bun drizzle-indexeddb-generate [options]

Options:
  --drizzle-dir <path>  Path to Drizzle directory (default: ./drizzle)
  --output-dir <path>   Path to output directory (default: ./drizzle/indexeddb-migrations)
  -h, --help            Show this help message

Examples:
  bun drizzle-indexeddb-generate
  bun drizzle-indexeddb-generate --drizzle-dir ./db/drizzle
  bun drizzle-indexeddb-generate --output-dir ./src/migrations
`);
	} else {
		console.error(`Unknown command: ${command}`);
		console.error(`Run 'bun drizzle-indexeddb-generate --help' for usage`);
		process.exit(1);
	}
}

// Only run CLI when executed directly (not when imported)
// import.meta.main is true in Bun when the file is run directly
if (import.meta.main) {
	main();
}
