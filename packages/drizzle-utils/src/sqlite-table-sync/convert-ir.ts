import type { IR } from "@tanstack/db";
import {
	eq,
	sql,
	type Table,
	gt,
	gte,
	lt,
	lte,
	ne,
	and,
	or,
	not,
	isNull,
	isNotNull,
	like,
	inArray,
	asc,
	desc,
	type SQL,
} from "drizzle-orm";
import { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { exhaustiveGuard } from "@firtoz/maybe-error";

/**
 * Converts TanStack DB IR BasicExpression to Drizzle SQL expression.
 */
export function convertBasicExpressionToDrizzle<TTable extends Table>(
	expression: IR.BasicExpression,
	table: TTable,
): SQL {
	switch (expression.type) {
		case "ref": {
			const propRef = expression;
			const columnName = propRef.path[propRef.path.length - 1];
			const column = table[columnName as keyof typeof table];

			if (!column || !(column instanceof SQLiteColumn)) {
				console.error("[SQLite sync backend] Column lookup failed:", {
					columnName,
					column,
					tableKeys: Object.keys(table),
					hasColumn: columnName in table,
				});
				throw new Error(`Column ${String(columnName)} not found in table`);
			}

			return column as unknown as SQL;
		}
		case "val": {
			const value = expression;
			return sql`${value.value}`;
		}
		case "func": {
			const func = expression;
			const args = func.args.map((arg) =>
				convertBasicExpressionToDrizzle(arg, table),
			);

			switch (func.name) {
				case "eq":
					return eq(args[0], args[1]);
				case "ne":
					return ne(args[0], args[1]);
				case "gt":
					return gt(args[0], args[1]);
				case "gte":
					return gte(args[0], args[1]);
				case "lt":
					return lt(args[0], args[1]);
				case "lte":
					return lte(args[0], args[1]);
				case "and": {
					const result = and(...args);
					if (!result) {
						throw new Error("Invalid 'and' expression - no arguments provided");
					}
					return result;
				}
				case "or": {
					const result = or(...args);
					if (!result) {
						throw new Error("Invalid 'or' expression - no arguments provided");
					}
					return result;
				}
				case "not":
					return not(args[0]);
				case "isNull":
					return isNull(args[0]);
				case "isNotNull":
					return isNotNull(args[0]);
				case "like":
					return like(args[0], args[1]);
				case "in":
					return inArray(args[0], args[1]);
				case "isUndefined":
					return isNull(args[0]);
				default:
					throw new Error(`Unsupported function: ${func.name}`);
			}
		}
		default:
			exhaustiveGuard(expression);
	}
}

export function convertOrderByToDrizzle<TTable extends Table>(
	orderBy: IR.OrderBy,
	table: TTable,
): SQL[] {
	return orderBy.map((clause) => {
		const expression = convertBasicExpressionToDrizzle(
			clause.expression,
			table,
		);
		const direction = clause.compareOptions.direction || "asc";

		return direction === "asc" ? asc(expression) : desc(expression);
	});
}
