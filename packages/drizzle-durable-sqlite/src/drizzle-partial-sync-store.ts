import type {
	PartialSyncRowShape,
	PartialSyncServerBridgeStore,
	RangeCondition,
	SyncRange,
	SyncRangeSort,
} from "@firtoz/collection-sync";
import { compareInterestValues } from "@firtoz/collection-sync/partial-sync-interest";
import {
	defaultPredicateColumnValue,
	matchesPredicate,
} from "@firtoz/collection-sync/partial-sync-predicate-match";
import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	lt,
	max,
	or,
	type InferSelectModel,
	type SQL,
} from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type {
	ChangelogOperation,
	DrizzleChangelogHelper,
} from "./drizzle-partial-sync-changelog";
import type { PartialSyncSqliteDatabase } from "./partial-sync-sqlite-db";
import {
	predicateWhereFromConditions,
	sortColumnFromConfig,
	type PartialSyncTableConfig,
} from "./partial-sync-predicate-sql";

export type CreateDrizzlePartialSyncStoreOptions<
	TSchema extends Record<string, unknown>,
	TRow extends PartialSyncRowShape,
> = {
	db: PartialSyncSqliteDatabase<TSchema>;
	table: SQLiteTable;
	columnConfig: PartialSyncTableConfig;
	changelogHelper: DrizzleChangelogHelper<TSchema>;
	deserializeJson: (raw: string) => unknown;
	/** Column name on `table` used for `changesSince` watermark (e.g. `updatedAt`). */
	updatedAtColumnName: keyof TRow & string;
};

export function createDrizzlePartialSyncStore<
	TSchema extends Record<string, unknown>,
	TRow extends PartialSyncRowShape,
>(
	options: CreateDrizzlePartialSyncStoreOptions<TSchema, TRow>,
): PartialSyncServerBridgeStore<TRow> {
	const { db, table, columnConfig, changelogHelper, deserializeJson } = options;
	const tableColumns = getTableColumns(table);
	const idCol = tableColumns.id;
	const updatedAtCol = tableColumns[options.updatedAtColumnName];
	if (idCol === undefined) {
		throw new Error("Partial sync table must have an id column");
	}
	if (updatedAtCol === undefined) {
		throw new Error(
			`Partial sync table missing updatedAt column: ${String(options.updatedAtColumnName)}`,
		);
	}

	async function* queryRange(opts: {
		sort: SyncRangeSort;
		limit: number;
		afterCursor: unknown | null;
		chunkSize: number;
	}): AsyncIterable<TRow[]> {
		let remaining = opts.limit;
		let cursor = opts.afterCursor;
		const sortColumn = sortColumnFromConfig(
			table,
			opts.sort.column,
			columnConfig,
		);
		while (remaining > 0) {
			const currentLimit = Math.min(opts.chunkSize, remaining);
			const directionExpr =
				opts.sort.direction === "asc" ? asc(sortColumn) : desc(sortColumn);
			const whereCursor =
				cursor === null
					? undefined
					: opts.sort.direction === "asc"
						? gt(sortColumn, cursor as never)
						: lt(sortColumn, cursor as never);
			const rows = await db
				.select()
				.from(table)
				.where(whereCursor ? and(whereCursor) : undefined)
				.orderBy(directionExpr, asc(idCol))
				.limit(currentLimit);
			if (rows.length === 0) break;
			yield rows as TRow[];
			remaining -= rows.length;
			if (rows.length < currentLimit) break;
			const last = rows[rows.length - 1] as Record<string, unknown>;
			cursor = last[opts.sort.column];
		}
	}

	async function* queryByOffset(opts: {
		sort: SyncRangeSort;
		limit: number;
		offset: number;
		chunkSize: number;
	}): AsyncIterable<TRow[]> {
		let remaining = opts.limit;
		let sqlOffset = opts.offset;
		const sortColumn = sortColumnFromConfig(
			table,
			opts.sort.column,
			columnConfig,
		);
		while (remaining > 0) {
			const currentLimit = Math.min(opts.chunkSize, remaining);
			const directionExpr =
				opts.sort.direction === "asc" ? asc(sortColumn) : desc(sortColumn);
			const rows = await db
				.select()
				.from(table)
				.orderBy(directionExpr, asc(idCol))
				.limit(currentLimit)
				.offset(sqlOffset);
			if (rows.length === 0) break;
			yield rows as TRow[];
			remaining -= rows.length;
			sqlOffset += rows.length;
			if (rows.length < currentLimit) break;
		}
	}

	async function getTotalCount(): Promise<number> {
		const rows = await db.select({ c: count() }).from(table);
		return rows[0]?.c ?? 0;
	}

	function getSortValue(row: TRow, column: string): unknown {
		return (row as Record<string, unknown>)[column];
	}

	async function* queryByPredicate(opts: {
		conditions: RangeCondition[];
		sort?: SyncRangeSort;
		limit?: number;
		chunkSize: number;
	}): AsyncIterable<TRow[]> {
		const limit = opts.limit ?? opts.chunkSize;
		let remaining = limit;
		let offset = 0;
		const where = predicateWhereFromConditions(
			table,
			opts.conditions,
			columnConfig,
		);
		const sortColumnName = opts.sort?.column ?? columnConfig.sortableColumns[0];
		if (sortColumnName === undefined) {
			throw new Error("queryByPredicate requires sort or sortableColumns[0]");
		}
		const sortColumn = sortColumnFromConfig(
			table,
			sortColumnName,
			columnConfig,
		);
		const directionExpr =
			opts.sort?.direction === "desc" ? desc(sortColumn) : asc(sortColumn);
		while (remaining > 0) {
			const currentLimit = Math.min(opts.chunkSize, remaining);
			const rows = await db
				.select()
				.from(table)
				.where(where)
				.orderBy(directionExpr, asc(idCol))
				.limit(currentLimit)
				.offset(offset);
			if (rows.length === 0) break;
			yield rows as TRow[];
			remaining -= rows.length;
			offset += rows.length;
			if (rows.length < currentLimit) break;
		}
	}

	async function getPredicateCount(
		conditions: RangeCondition[],
	): Promise<number> {
		const where = predicateWhereFromConditions(table, conditions, columnConfig);
		const rows = await db.select({ c: count() }).from(table).where(where);
		return rows[0]?.c ?? 0;
	}

	function strictlyBeforeInSortOrder(
		sortCol: ReturnType<typeof sortColumnFromConfig>,
		idColSQLite: typeof idCol,
		rowSort: unknown,
		rowId: unknown,
		direction: "asc" | "desc",
	): SQL {
		if (direction === "asc") {
			return or(
				lt(sortCol, rowSort as never),
				and(eq(sortCol, rowSort as never), lt(idColSQLite, rowId as never)),
			) as SQL;
		}
		return or(
			gt(sortCol, rowSort as never),
			and(eq(sortCol, rowSort as never), lt(idColSQLite, rowId as never)),
		) as SQL;
	}

	async function rowInIndexRange(
		row: TRow,
		indexRange: Extract<SyncRange, { kind: "index" }>,
	): Promise<boolean> {
		const sortName = indexRange.sort.column;
		const rowRec = row as Record<string, unknown>;
		const rowSort = rowRec[sortName];
		const rowId = rowRec.id;
		const sortCol = sortColumnFromConfig(table, sortName, columnConfig);

		if (indexRange.mode === "cursor") {
			const ac = indexRange.afterCursor;
			if (ac !== null) {
				const cmp = compareInterestValues(rowSort, ac);
				if (indexRange.sort.direction === "asc" && cmp <= 0) return false;
				if (indexRange.sort.direction === "desc" && cmp >= 0) return false;
			}
		}

		const before = strictlyBeforeInSortOrder(
			sortCol,
			idCol,
			rowSort,
			rowId,
			indexRange.sort.direction,
		);
		let whereRank: SQL = before;
		if (indexRange.mode === "cursor" && indexRange.afterCursor !== null) {
			const eligible =
				indexRange.sort.direction === "asc"
					? gt(sortCol, indexRange.afterCursor as never)
					: lt(sortCol, indexRange.afterCursor as never);
			whereRank = and(eligible, before) as SQL;
		}
		const rankRows = await db
			.select({ c: count() })
			.from(table)
			.where(whereRank);
		const rank = rankRows[0]?.c ?? 0;

		if (indexRange.mode === "offset") {
			return (
				rank >= indexRange.offset && rank < indexRange.offset + indexRange.limit
			);
		}
		return rank < indexRange.limit;
	}

	async function changelogEntryMatchesRange(
		op: ChangelogOperation,
		payloadJson: unknown,
		range: SyncRange,
	): Promise<boolean> {
		if (range.kind === "predicate") {
			const conds = range.conditions;
			switch (op) {
				case "delete": {
					if (payloadJson === null || typeof payloadJson !== "string") {
						return false;
					}
					const prev = deserializeJson(payloadJson) as TRow;
					return matchesPredicate(prev, conds, defaultPredicateColumnValue);
				}
				case "insert": {
					if (payloadJson === null || typeof payloadJson !== "string") {
						return false;
					}
					const value = deserializeJson(payloadJson) as TRow;
					return matchesPredicate(value, conds, defaultPredicateColumnValue);
				}
				case "update": {
					if (payloadJson === null || typeof payloadJson !== "string") {
						return false;
					}
					const parsed = deserializeJson(payloadJson) as {
						value: TRow;
						previousValue: TRow;
					};
					return (
						matchesPredicate(
							parsed.value,
							conds,
							defaultPredicateColumnValue,
						) ||
						matchesPredicate(
							parsed.previousValue,
							conds,
							defaultPredicateColumnValue,
						)
					);
				}
				default:
					exhaustiveGuard(op);
			}
		}
		if (range.kind === "index") {
			switch (op) {
				case "delete": {
					if (payloadJson === null || typeof payloadJson !== "string") {
						return false;
					}
					const prev = deserializeJson(payloadJson) as TRow;
					return rowInIndexRange(prev, range);
				}
				case "insert": {
					if (payloadJson === null || typeof payloadJson !== "string") {
						return false;
					}
					const value = deserializeJson(payloadJson) as TRow;
					return rowInIndexRange(value, range);
				}
				case "update": {
					if (payloadJson === null || typeof payloadJson !== "string") {
						return false;
					}
					const parsed = deserializeJson(payloadJson) as {
						value: TRow;
						previousValue: TRow;
					};
					return (
						(await rowInIndexRange(parsed.value, range)) ||
						(await rowInIndexRange(parsed.previousValue, range))
					);
				}
				default:
					exhaustiveGuard(op);
			}
		}
		return false;
	}

	async function changesSince(opts: {
		range: SyncRange;
		sinceVersion: number;
		chunkSize: number;
	}): Promise<{ changes: SyncMessage<TRow>[]; totalCount: number } | null> {
		const totalCount = await getTotalCount();
		const maxRow = await db.select({ m: max(updatedAtCol) }).from(table);
		const m = maxRow[0]?.m;
		const maxMs = m instanceof Date ? m.getTime() : Number(m ?? 0);
		if (opts.sinceVersion >= maxMs) {
			return { changes: [], totalCount };
		}
		const logRows = await changelogHelper.selectAfterVersion(opts.sinceVersion);
		if (logRows.length === 0) {
			return null;
		}
		const changes: SyncMessage<TRow>[] = [];
		for (const entry of logRows) {
			const row = entry as Record<string, unknown>;
			const op = row.operation;
			const rowId = row.rowId;
			const payloadJson = row.payloadJson;
			if (typeof op !== "string" || typeof rowId !== "string") {
				throw new Error("Invalid changelog row shape");
			}
			if (op !== "insert" && op !== "update" && op !== "delete") {
				throw new Error(`Unknown changelog operation: ${op}`);
			}
			if (
				!(await changelogEntryMatchesRange(
					op as ChangelogOperation,
					payloadJson,
					opts.range,
				))
			) {
				continue;
			}
			switch (op) {
				case "delete":
					changes.push({ type: "delete", key: rowId });
					break;
				case "insert": {
					if (payloadJson === null || typeof payloadJson !== "string") break;
					const value = deserializeJson(payloadJson) as TRow;
					changes.push({ type: "insert", value });
					break;
				}
				case "update": {
					if (payloadJson === null || typeof payloadJson !== "string") break;
					const parsed = deserializeJson(payloadJson) as {
						value: TRow;
						previousValue: TRow;
					};
					changes.push({
						type: "update",
						value: parsed.value,
						previousValue: parsed.previousValue,
					});
					break;
				}
				default:
					exhaustiveGuard(op);
			}
		}
		return { changes, totalCount };
	}

	async function getRow(key: string | number): Promise<TRow | undefined> {
		const rows = await db
			.select()
			.from(table)
			.where(eq(idCol, key as never))
			.limit(1);
		const r = rows[0];
		return r !== undefined ? (r as TRow) : undefined;
	}

	return {
		queryRange,
		queryByOffset,
		getTotalCount,
		getSortValue,
		queryByPredicate,
		getPredicateCount,
		changesSince,
		getRow,
	};
}

/** Infer row type from a Drizzle SQLite table. */
export type InferPartialSyncRow<TTable extends SQLiteTable> =
	InferSelectModel<TTable>;
