import type { RangeCondition, SyncRange } from "@firtoz/collection-sync";
import { QueryableDurableObject } from "@firtoz/drizzle-durable-sqlite";
import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	gte,
	lt,
	lte,
	max,
	ne,
	sql,
} from "drizzle-orm";
import type { InferSelectModel, SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import superjson from "superjson";
import migrations from "../drizzle/migrations.js";
import * as schema from "./schema";

type PersonRow = InferSelectModel<typeof schema.peopleTable>;

const SEED_ROW_COUNT = 100_000;

export class PeopleSyncDO extends QueryableDurableObject<
	PersonRow,
	typeof schema
> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			schema,
			migrations,
			queryChunkSize: 200,
			seedInBackground: true,
			serializeJson: (value: unknown) => superjson.stringify(value),
			deserializeJson: (raw: string) => superjson.parse(raw),
		});
	}

	protected override async *queryRange(options: {
		sort: { column: string; direction: "asc" | "desc" };
		limit: number;
		afterCursor: unknown | null;
		chunkSize: number;
	}): AsyncIterable<PersonRow[]> {
		let remaining = options.limit;
		let cursor = options.afterCursor;
		const sortColumn =
			options.sort.column === "age"
				? schema.peopleTable.age
				: schema.peopleTable.name;
		while (remaining > 0) {
			const currentLimit = Math.min(options.chunkSize, remaining);
			const directionExpr =
				options.sort.direction === "asc" ? asc(sortColumn) : desc(sortColumn);
			const whereCursor =
				cursor === null
					? undefined
					: options.sort.direction === "asc"
						? gt(sortColumn, cursor as never)
						: lt(sortColumn, cursor as never);
			const rows = await this.db
				.select()
				.from(schema.peopleTable)
				.where(whereCursor ? and(whereCursor) : undefined)
				.orderBy(directionExpr, asc(schema.peopleTable.id))
				.limit(currentLimit);
			if (rows.length === 0) break;
			yield rows as PersonRow[];
			remaining -= rows.length;
			if (rows.length < currentLimit) break;
			cursor = rows[rows.length - 1][options.sort.column as "name" | "age"];
		}
	}

	protected override async *queryByOffset(options: {
		sort: { column: string; direction: "asc" | "desc" };
		limit: number;
		offset: number;
		chunkSize: number;
	}): AsyncIterable<PersonRow[]> {
		let remaining = options.limit;
		let sqlOffset = options.offset;
		const sortColumn =
			options.sort.column === "age"
				? schema.peopleTable.age
				: schema.peopleTable.name;
		while (remaining > 0) {
			const currentLimit = Math.min(options.chunkSize, remaining);
			const directionExpr =
				options.sort.direction === "asc" ? asc(sortColumn) : desc(sortColumn);
			const rows = await this.db
				.select()
				.from(schema.peopleTable)
				.orderBy(directionExpr, asc(schema.peopleTable.id))
				.limit(currentLimit)
				.offset(sqlOffset);
			if (rows.length === 0) break;
			yield rows as PersonRow[];
			remaining -= rows.length;
			sqlOffset += rows.length;
			if (rows.length < currentLimit) break;
		}
	}

	protected override async getTotalCount(): Promise<number> {
		const rows = await this.db
			.select({ count: count() })
			.from(schema.peopleTable);
		return rows[0]?.count ?? 0;
	}

	protected override getSortValue(row: PersonRow, column: string): unknown {
		if (column === "age") return row.age;
		return row.name;
	}

	#columnRef(column: string): SQLiteColumn {
		if (column === "age") return schema.peopleTable.age;
		if (column === "name") return schema.peopleTable.name;
		throw new Error(`Unsupported predicate column: ${column}`);
	}

	#coercePredicateScalar(column: string, value: unknown): string | number {
		if (column === "age") {
			const n = Number(value);
			if (!Number.isFinite(n)) {
				throw new Error("Predicate age value must be a finite number");
			}
			return n;
		}
		return String(value);
	}

	#predicateCondition(condition: RangeCondition): SQL {
		const col = this.#columnRef(condition.column);
		switch (condition.op) {
			case "eq":
				return eq(
					col,
					this.#coercePredicateScalar(condition.column, condition.value),
				);
			case "neq":
				return ne(
					col,
					this.#coercePredicateScalar(condition.column, condition.value),
				);
			case "gt":
				return gt(
					col,
					this.#coercePredicateScalar(condition.column, condition.value),
				);
			case "gte":
				return gte(
					col,
					this.#coercePredicateScalar(condition.column, condition.value),
				);
			case "lt":
				return lt(
					col,
					this.#coercePredicateScalar(condition.column, condition.value),
				);
			case "lte":
				return lte(
					col,
					this.#coercePredicateScalar(condition.column, condition.value),
				);
			case "between": {
				const from = this.#coercePredicateScalar(
					condition.column,
					condition.value,
				);
				const to = this.#coercePredicateScalar(
					condition.column,
					condition.valueTo,
				);
				return and(gte(col, from), lte(col, to)) as SQL;
			}
			default:
				exhaustiveGuard(condition.op);
		}
	}

	#predicateWhere(conditions: RangeCondition[]): SQL | undefined {
		if (conditions.length === 0) return undefined;
		const parts = conditions.map((c) => this.#predicateCondition(c));
		return parts.length === 1 ? parts[0] : (and(...parts) as SQL);
	}

	protected override async *queryByPredicate(options: {
		conditions: RangeCondition[];
		sort?: { column: string; direction: "asc" | "desc" };
		limit?: number;
		chunkSize: number;
	}): AsyncIterable<PersonRow[]> {
		const limit = options.limit ?? options.chunkSize;
		let remaining = limit;
		let offset = 0;
		const where = this.#predicateWhere(options.conditions);
		const sortColumn =
			options.sort?.column === "age"
				? schema.peopleTable.age
				: schema.peopleTable.name;
		const directionExpr =
			options.sort?.direction === "desc" ? desc(sortColumn) : asc(sortColumn);
		while (remaining > 0) {
			const currentLimit = Math.min(options.chunkSize, remaining);
			const rows = await this.db
				.select()
				.from(schema.peopleTable)
				.where(where)
				.orderBy(directionExpr, asc(schema.peopleTable.id))
				.limit(currentLimit)
				.offset(offset);
			if (rows.length === 0) break;
			yield rows as PersonRow[];
			remaining -= rows.length;
			offset += rows.length;
			if (rows.length < currentLimit) break;
		}
	}

	protected override async getPredicateCount(
		conditions: RangeCondition[],
	): Promise<number> {
		const where = this.#predicateWhere(conditions);
		const rows = await this.db
			.select({ c: count() })
			.from(schema.peopleTable)
			.where(where);
		return rows[0]?.c ?? 0;
	}

	protected override async changesSince(options: {
		range: SyncRange;
		sinceVersion: number;
		chunkSize: number;
	}): Promise<{
		changes: SyncMessage<PersonRow>[];
		totalCount: number;
	} | null> {
		void options.range;
		const totalCount = await this.getTotalCount();
		const maxRow = await this.db
			.select({ m: max(schema.peopleTable.updatedAt) })
			.from(schema.peopleTable);
		const m = maxRow[0]?.m;
		const maxMs = m instanceof Date ? m.getTime() : Number(m ?? 0);
		if (options.sinceVersion >= maxMs) {
			return { changes: [], totalCount };
		}
		const logRows = await this.db
			.select()
			.from(schema.syncChangelogTable)
			.where(
				gt(schema.syncChangelogTable.version, new Date(options.sinceVersion)),
			);
		if (logRows.length === 0) {
			return null;
		}
		const changes: SyncMessage<PersonRow>[] = [];
		for (const entry of logRows) {
			const op = entry.operation;
			if (op !== "insert" && op !== "update" && op !== "delete") {
				throw new Error(`Unknown changelog operation: ${op}`);
			}
			switch (op) {
				case "delete":
					changes.push({ type: "delete", key: entry.rowId });
					break;
				case "insert": {
					if (entry.payloadJson === null) break;
					const value = superjson.parse(entry.payloadJson) as PersonRow;
					changes.push({ type: "insert", value });
					break;
				}
				case "update": {
					if (entry.payloadJson === null) break;
					const parsed = superjson.parse(entry.payloadJson) as {
						value: PersonRow;
						previousValue: PersonRow;
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

	protected override async seedData(): Promise<void> {
		const existing = await this.getTotalCount();
		if (existing >= SEED_ROW_COUNT) return;
		// Single INSERT…SELECT + recursive CTE: rows are generated in-engine (few bound params vs multi-row VALUES).
		const ts = Date.now();
		this.db.run(sql`
			WITH RECURSIVE seq(n) AS (
				SELECT ${existing}
				UNION ALL
				SELECT n + 1 FROM seq WHERE n < ${SEED_ROW_COUNT - 1}
			)
			INSERT INTO people (id, createdAt, updatedAt, deletedAt, name, age)
			SELECT
				lower(hex(randomblob(16))),
				${ts},
				${ts},
				NULL,
				substr('abcdefghijklmnopqrstuvwxyz', 1 + ((n / 456976) % 26), 1) ||
					substr('abcdefghijklmnopqrstuvwxyz', 1 + ((n / 17576) % 26), 1) ||
					substr('abcdefghijklmnopqrstuvwxyz', 1 + ((n / 676) % 26), 1) ||
					substr('abcdefghijklmnopqrstuvwxyz', 1 + ((n / 26) % 26), 1) ||
					substr('abcdefghijklmnopqrstuvwxyz', 1 + (n % 26), 1),
				13 + (abs(random()) % 73)
			FROM seq
		`);
	}
}
