import { QueryableDurableObject } from "@firtoz/drizzle-durable-sqlite";
import { and, asc, count, desc, gt, lt, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
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
