import {
	integer,
	text,
	sqliteTable,
	type SQLiteColumnBuilderBase,
	type TableConfig,
	type SQLiteTableExtraConfigValue,
	type SQLiteTableWithColumns,
} from "drizzle-orm/sqlite-core";
import { type BuildColumns, getTableColumns, SQL } from "drizzle-orm";
import type { TableId } from "./collection-utils";

const createTableIdColumn = <TTableName extends string>() =>
	text("id")
		.primaryKey()
		.$type<TableId<TTableName>>()
		.$defaultFn(() => {
			return crypto.randomUUID() as TableId<TTableName>;
		});

// Use unixepoch with 'subsec' modifier for millisecond precision timestamps
export const createdAtColumn = integer("createdAt", { mode: "timestamp_ms" })
	.$defaultFn(() => new Date())
	.notNull();

export const updatedAtColumn = integer("updatedAt", { mode: "timestamp_ms" })
	.$defaultFn(() => new Date())
	.notNull();

export const deletedAtColumn = integer("deletedAt", {
	mode: "timestamp_ms",
});

export const syncableTable = <
	TTableName extends string,
	TColumns extends Record<string, SQLiteColumnBuilderBase> & {
		id?: never;
		createdAt?: never;
		updatedAt?: never;
		deletedAt?: never;
	},
>(
	tableName: TTableName,
	columns: TColumns,
	extraConfig?: (
		self: BuildColumns<
			TTableName,
			Omit<TColumns, "id" | "createdAt" | "updatedAt" | "deletedAt"> & {
				id: ReturnType<typeof createTableIdColumn<TTableName>>;
				createdAt: typeof createdAtColumn;
				updatedAt: typeof updatedAtColumn;
				deletedAt: typeof deletedAtColumn;
			},
			"sqlite"
		>,
	) => SQLiteTableExtraConfigValue[],
) => {
	const tableIdColumn = createTableIdColumn<TTableName>();
	const table = sqliteTable(
		tableName,
		{
			id: tableIdColumn,
			createdAt: createdAtColumn,
			updatedAt: updatedAtColumn,
			deletedAt: deletedAtColumn,
			...columns,
		},
		extraConfig,
	);

	const tableColumns = getTableColumns(table);

	// console.log("table:", table);

	for (const columnName in tableColumns) {
		const column = tableColumns[columnName];

		// Avoid executing defaultFn at module initialization time.
		// In Cloudflare Workers this can trigger disallowed global-scope APIs.
		if (column.defaultFn) {
			continue;
		}
		if (column.default instanceof SQL) {
			throw new Error(
				`Default value for column ${tableName}.${columnName} is a SQL expression, which is not supported for IndexedDB.\n\nYou can use a default value or a default function instead.`,
			);
		}
	}

	return table;
};

export type TableWithRequiredFields = SQLiteTableWithColumns<
	Pick<TableConfig, "name" | "schema" | "dialect"> & {
		columns: BuildColumns<
			string,
			{
				id: ReturnType<typeof createTableIdColumn<string>>;
				createdAt: typeof createdAtColumn;
				updatedAt: typeof updatedAtColumn;
				deletedAt: typeof deletedAtColumn;
			},
			"sqlite"
		>;
	}
>;
