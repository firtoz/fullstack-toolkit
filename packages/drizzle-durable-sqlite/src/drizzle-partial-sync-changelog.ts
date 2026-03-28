import { getTableColumns, gt } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { PartialSyncSqliteDatabase } from "./partial-sync-sqlite-db";

export type ChangelogOperation = "insert" | "update" | "delete";

export type DrizzleChangelogHelperOptions<TSchema extends Record<string, unknown>> =
	{
		db: PartialSyncSqliteDatabase<TSchema>;
		changelogTable: SQLiteTable;
		serializeJson: (value: unknown) => string;
	};

export function createDrizzleChangelogHelper<TSchema extends Record<string, unknown>>(
	options: DrizzleChangelogHelperOptions<TSchema>,
) {
	const cols = getTableColumns(options.changelogTable);
	const rowIdCol = cols.rowId;
	const operationCol = cols.operation;
	const versionCol = cols.version;
	if (
		rowIdCol === undefined ||
		operationCol === undefined ||
		versionCol === undefined
	) {
		throw new Error(
			"changelogTable must have rowId, operation, and version columns",
		);
	}

	return {
		append: async (
			operation: ChangelogOperation,
			rowId: string,
			payload: unknown,
		): Promise<void> => {
			const version = new Date();
			await options.db
				.insert(options.changelogTable)
				.values({
					rowId,
					operation,
					version,
					payloadJson:
						payload === null || payload === undefined
							? null
							: options.serializeJson(payload),
				} as Record<string, unknown>);
		},

		selectAfterVersion: async (sinceVersionMs: number) => {
			const rows = await options.db
				.select()
				.from(options.changelogTable)
				.where(gt(versionCol, new Date(sinceVersionMs)));
			return rows;
		},

		deleteAll: async (): Promise<void> => {
			await options.db.delete(options.changelogTable);
		},
	};
}

export type DrizzleChangelogHelper<TSchema extends Record<string, unknown>> =
	ReturnType<typeof createDrizzleChangelogHelper<TSchema>>;
