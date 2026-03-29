import type { RangeCondition } from "@firtoz/collection-sync";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import {
	and,
	eq,
	getTableColumns,
	gt,
	gte,
	lt,
	lte,
	ne,
	type SQL,
} from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";

/** Column kind for predicate coercion and sort. */
export type PartialSyncColumnKind = "text" | "integer";

export type PartialSyncTableColumnConfig = {
	kind: PartialSyncColumnKind;
	/**
	 * When kind is `integer`, use `Math.trunc` after `Number()` (grid coordinates).
	 * Default false: finite number only.
	 */
	truncateInteger?: boolean;
};

/**
 * Declares which table columns exist for predicates/sorts and how to coerce literals.
 * `sortableColumns` must be a subset of keys in `columns`.
 */
export type PartialSyncTableConfig<TSortable extends string = string> = {
	columns: Record<string, PartialSyncTableColumnConfig>;
	sortableColumns: readonly TSortable[];
};

export function columnRefForPredicate(
	table: SQLiteTable,
	columnName: string,
	columnConfig: PartialSyncTableConfig,
): SQLiteColumn {
	const meta = columnConfig.columns[columnName];
	if (meta === undefined) {
		throw new Error(`Unsupported predicate column: ${columnName}`);
	}
	const cols = getTableColumns(table);
	const col = cols[columnName];
	if (col === undefined) {
		throw new Error(`Table has no column: ${columnName}`);
	}
	return col as SQLiteColumn;
}

export function coercePredicateScalar(
	column: string,
	value: unknown,
	columnConfig: PartialSyncTableConfig,
): string | number {
	const meta = columnConfig.columns[column];
	if (meta === undefined) {
		throw new Error(`Unsupported predicate column: ${column}`);
	}
	if (meta.kind === "integer") {
		const n = Number(value);
		if (!Number.isFinite(n)) {
			throw new Error(`Predicate ${column} value must be a finite number`);
		}
		return meta.truncateInteger === true ? Math.trunc(n) : n;
	}
	return String(value);
}

export function rangeConditionToSQL(
	table: SQLiteTable,
	condition: RangeCondition,
	columnConfig: PartialSyncTableConfig,
): SQL {
	const col = columnRefForPredicate(table, condition.column, columnConfig);
	switch (condition.op) {
		case "eq":
			return eq(
				col,
				coercePredicateScalar(condition.column, condition.value, columnConfig),
			);
		case "neq":
			return ne(
				col,
				coercePredicateScalar(condition.column, condition.value, columnConfig),
			);
		case "gt":
			return gt(
				col,
				coercePredicateScalar(condition.column, condition.value, columnConfig),
			);
		case "gte":
			return gte(
				col,
				coercePredicateScalar(condition.column, condition.value, columnConfig),
			);
		case "lt":
			return lt(
				col,
				coercePredicateScalar(condition.column, condition.value, columnConfig),
			);
		case "lte":
			return lte(
				col,
				coercePredicateScalar(condition.column, condition.value, columnConfig),
			);
		case "between": {
			const from = coercePredicateScalar(
				condition.column,
				condition.value,
				columnConfig,
			);
			const to = coercePredicateScalar(
				condition.column,
				condition.valueTo,
				columnConfig,
			);
			return and(gte(col, from), lte(col, to)) as SQL;
		}
		default:
			exhaustiveGuard(condition.op);
	}
}

export function predicateWhereFromConditions(
	table: SQLiteTable,
	conditions: RangeCondition[],
	columnConfig: PartialSyncTableConfig,
): SQL | undefined {
	if (conditions.length === 0) return undefined;
	const parts = conditions.map((c) =>
		rangeConditionToSQL(table, c, columnConfig),
	);
	return parts.length === 1 ? parts[0] : (and(...parts) as SQL);
}

export function sortColumnFromConfig(
	table: SQLiteTable,
	columnName: string,
	columnConfig: PartialSyncTableConfig,
): SQLiteColumn {
	if (!columnConfig.sortableColumns.includes(columnName as never)) {
		throw new Error(`Unsupported sort column: ${columnName}`);
	}
	if (columnConfig.columns[columnName] === undefined) {
		throw new Error(`Unknown column in sort: ${columnName}`);
	}
	const cols = getTableColumns(table);
	const col = cols[columnName];
	if (col === undefined) {
		throw new Error(`Table has no column: ${columnName}`);
	}
	return col as SQLiteColumn;
}
